import * as fs from "fs";
import {PathLike} from "fs";
import * as mime from 'mime';
import {Request, Response} from "express";

export function sendFile(req:Request, res:Response, path: PathLike, status: number, args:any = {}) {
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
    res.setHeader("Content-Type", type??"text/html")
    res.writeHead(status)
    if (res.req.method !== 'HEAD')
        res.write(content);
    res.end()
}


export function replaceAll(content: string, s: string, s2: string) {
    return content.split(s).join(s2)
}

export function btoa(obj:any):string {
    if (!obj) return "";
    if (typeof (obj) == "string") {
        return btoa_i(obj)
    } else {
        return btoa(JSON.stringify(obj))
    }
}

function btoa_i(str: string) {
    return Buffer.from(str).toString("base64");
}

export function sendText(res:Response, text:string, code:number) {
    try {
        res.writeHead(code, {"Content-Type": "text/plain; charset=utf-8"})
        if (text && res.req.method !== 'HEAD')
            res.write(text)
        res.end()
    } catch {
    }
}

export function sendJSON(res:Response, json:any, code:number) {
    try {
        let txt = JSON.stringify(json)
        res.writeHead(code, {"Content-Type": "application/json"})
        if (txt && res.req.method !== 'HEAD')
            res.write(txt)
        res.end()
    } catch {
    }
}

export function sendCompletion(res:Response, text:string, error:boolean, code:number) {
    sendJSON(res, {error: error, text: text}, code);
}