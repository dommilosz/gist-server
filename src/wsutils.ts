import * as fs from "fs";
import {PathLike} from "fs";
import * as mime from 'mime';

export function sendFile(req, res, path: PathLike, status: number, args = {}) {
    // @ts-ignore
    let type = mime.getType(path);
    let content = fs.readFileSync(path, {encoding: 'utf-8'});

    Object.keys(args).forEach(key => {
        if(typeof(args[key]) === 'string'){
            content = replaceAll(content, `%key=%${key}%`, args[key])
        }else{
            content = replaceAll(content, `"%key=%${key}%"`, `JSON.parse(atob("${btoa(JSON.stringify(args[key]))}"))`)
        }
    })
    res.setHeader("Content-Type", type)
    res.writeHead(status)
    if (res.req.method !== 'HEAD')
        res.write(content);
    res.end()
}


export function replaceAll(content: string, s: string, s2: string) {
    return content.split(s).join(s2)
}

export function btoa(obj) {
    if (!obj) return;
    if (typeof (obj) == "string") {
        return btoa_i(obj)
    } else {
        return btoa(JSON.stringify(obj))
    }
}

function btoa_i(str: string) {
    return Buffer.from(str).toString("base64");
}

export function sendText(res, text, code) {
    try {
        res.writeHead(code, {"Content-Type": "text/html; charset=utf-8"})
        if (text && res.req.method !== 'HEAD')
            res.write(text)
        res.end()
    } catch {
    }
}

export function sendJSON(res, json, code) {
    try {
        let txt = JSON.stringify(json)
        res.writeHead(code, {"Content-Type": "application/json"})
        if (txt && res.req.method !== 'HEAD')
            res.write(txt)
        res.end()
    } catch {
    }
}

export function sendCompletion(res, text, error, code) {
    sendJSON(res, {error: error, text: text}, code);
}