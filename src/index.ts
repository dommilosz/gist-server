import express, {json, Request, Response} from 'express'
import {sendCompletion, sendFile, sendJSON, sendText} from 'express-wsutils';
import {ParamsDictionary} from "express-serve-static-core"
import {firebase_db} from "./firebase";
import rateLimit from 'express-rate-limit'
import configured from 'configuredjs';
import cors from "cors";

let config = configured({
    path: "./config.json", writeMissing: true, defaultConfig: {
        validation: {
            maxShortUrlLength: 128,
            maxContentLength: 512 * 1024, //512KB
            minShortUrlLength: 5,
            randomRetries: 5,
            randomShortUrlLength: 8,
            maxNameLength: 64,
        },
        "rateLimiter": {
            "window": 300,
            "amount": 30
        },
        "port": 8008,
        "localization": {
            "loc-name-box-p": "Name",
            "loc-long-data-box-p": "Enter your text here",
            "loc-surl-box-p": "Leave empty to get random url",
            "loc-create-button": "Create",
            "loc-surl-out-box-p": "Here will be your gist url",
            "loc-rate-limits": "Rate limits apply: %1 gists in %2 minutes",
            "loc-name": "Gist Creator",
            "loc-view-name": "Gist View",
            "loc-edit-button": "Edit Gist",
        }
    }
})

const app = express()
const port = config.port
app.use(json({limit: '50mb'}));

const limiter = rateLimit({
    windowMs: config.rateLimiter.window * 1000, // 1 minutes
    max: config.rateLimiter.amount, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

config.localization["loc-rate-limits"] = config.localization["loc-rate-limits"].replace("%1", String(config.rateLimiter.amount));
config.localization["loc-rate-limits"] = config.localization["loc-rate-limits"].replace("%2", config.rateLimiter.window / 60 + " minutes");

app.use(cors())
app.use('/create', limiter)

app.get('/', (req: Request, res: Response) => {
    sendFile(req, res, "src/index.html", 200, config.localization);
})

app.get('/index.js', (req: Request, res: Response) => {
    sendFile(req, res, "src/front_index.js", 200, {config});
})

app.get('/index.css', (req: Request, res: Response) => {
    sendFile(req, res, "src/index.css", 200);
})

app.post('/create', async (req: Request, res: Response) => {
    let body = req.body;
    let data = body?.data;
    let name = body?.name;
    let directory:string = body?.directory;
    let urlShort:string = body?.urlShort;
    let result = await createGist(data, name, urlShort, directory);

    return sendCompletion(res, result.text, result.error, 200);
})

app.get('/favicon.ico', (req: Request, res: Response) => {
    sendText(res, "", 404);
})

export type GistType = {content:string, name:string};
export type FullGistType = {content:string, name:string, code:string};

async function readGist(urlShort: string, directory?:string):Promise<FullGistType|undefined> {
    let ref;
    if (!directory) {
        ref = firebase_db.collection("gists").doc(urlShort);
    } else {
        ref = firebase_db.collection(`directories/${directory}/gists`).doc(urlShort);
    }

    let snapshot = await ref.get();
    if (snapshot.exists) {
        let gist = snapshot.data() as GistType;
        return {...gist, code:urlShort};
    } else {
        return undefined;
    }
}

async function readGistFromParams(params:ParamsDictionary){
    let urlShort = params.shortUrl;
    let directory = params.directory;
    urlShort = encodeURIComponent(urlShort);
    directory = encodeURIComponent(directory);
    return await readGist(urlShort,directory);
}

app.get('/:shortUrl/:directory?', async (req: Request, res: Response) => {
    let gist = await readGistFromParams(req.params);
    if (gist) {
        let content = gist.content;
        let name = gist.name;
        sendFile(req, res, "src/gist-view.html", 200, {...config.localization, content, name, code: gist.code});
    } else {
        sendFile(req, res, "src/not-found.html", 404, config.localization);
    }
})

app.get('/data/:shortUrl/:directory?', async (req: Request, res: Response) => {
    let gist = await readGistFromParams(req.params);

    if (gist) {
        sendJSON(res, gist, 200)
    } else {
        sendText(res, "undefined", 404)
    }
})

app.get('/raw/:shortUrl/:directory?', async (req: Request, res: Response) => {
    let params = req.params;
    let urlShort = params.shortUrl;
    urlShort = encodeURIComponent(urlShort);
    let gist = await readGist(urlShort);
    if (gist) {
        let content = gist.content;
        sendText(res, content, 200)
    } else {
        sendText(res, "404 Not found", 404)
    }
})

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})

function makeid(length: number) {
    let result = '';
    let characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

let customRegex = new RegExp(`^A[a-zA-Z0-9]{${config.validation.randomShortUrlLength-1}}$`)

function isCustom(url: string) {
    return !customRegex.test(url);
}

async function createGist(data: string, name: string, urlShort: string, directory?:string, retriesLeft = config.validation.randomRetries): Promise<{ text: string, error: boolean }> {
    if (!urlShort) {
        urlShort = 'A' + makeid(config.validation.randomShortUrlLength - 1);
    }
    urlShort = encodeURIComponent(urlShort);
    let validationResult = validateUrlAndData(data, name, urlShort);
    if (validationResult.error) {
        return validationResult;
    }
    let custom = isCustom(urlShort);

    let ref;
    if (!directory) {
        ref = firebase_db.collection("gists").doc(urlShort);
    } else {
        ref = firebase_db.collection(`directories/${directory}/gists`).doc(urlShort);
    }

    let snapshot = await ref.get();
    if (snapshot.exists) {
        if (!custom) {
            if (retriesLeft < 1) {
                return {text: "Free url not found!", error: true};
            }
            return await createGist(data, name, "",directory, retriesLeft - 1);
        } else {
            return {text: "Url taken!", error: true};
        }
    }
    if (!name) {
        name = urlShort;
    }
    await ref.set({content: data, name});
    return {text: urlShort, error: false};
}

function validateUrlAndData(data: string, name: string, urlShort: string) {
    if (!data) {
        return {text: "data not provided", error: true};
    }
    if (name && name.length > config.validation.maxNameLength) {
        return {text: `name too long (max ${config.validation.maxNameLength})`, error: true};
    }
    if (data.length > config.validation.maxContentLength) {
        return {text: `data too long (max ${config.validation.maxContentLength})`, error: true};
    }
    if (urlShort.length > config.validation.maxShortUrlLength) {
        return {text: `Short Url too long (max ${config.validation.maxShortUrlLength})`, error: true};
    }
    if (urlShort && urlShort.length < config.validation.minShortUrlLength) {
        return {text: `Short Url too short (min ${config.validation.minShortUrlLength})`, error: true};
    }
    return {text: "", error: false};
}