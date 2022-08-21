let config = "%key=%config%";

function validateUrlAndData(data,name, urlShort){
    if (!data) {
        return {text:"data not provided",error:true};
    }
    if (name && name.length > config.validation.maxNameLength) {
        return {text:`name too long (max ${config.validation.maxNameLength})`,error:true};
    }
    if (data.length > config.validation.maxContentLength) {
        return {text:`data too long (max ${config.validation.maxContentLength})`,error:true};
    }
    if (urlShort.length > config.validation.maxShortUrlLength) {
        return {text:`Short Url too long (max ${config.validation.maxShortUrlLength})`,error:true};
    }
    if (urlShort && urlShort.length < config.validation.minShortUrlLength) {
        return {text: `Short Url too short (min ${config.validation.minShortUrlLength})`, error: true};
    }
    return {text:"",error:false};
}

async function createGist(data,name,urlShort){
    let validationResult = validateUrlAndData(data,name,urlShort);
    if(validationResult.error) return validationResult;

    let res = await fetch('/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({data,name,urlShort}),
    })

    let code = res.status;
    if(code === 429){
        let remaining = res.headers.get("RateLimit-Reset");
        let text = `${await res.text()} (${remaining}s remaining)`;
        return {error:true,text:text};
    }

    let json = await res.json();
    if(json.error){
        return {error:true,text:json.text};
    }else{
        return {error:false,text:json.text};
    }
}

async function do_create(){
    document.querySelector("#create-result-bar").innerHTML = "...";
    document.querySelector("#create-result-bar").style.backgroundColor = 'blue';
    document.querySelector('#surl-output').value = ``
    document.querySelector("#create-result-bar").style.color = 'white';

    let data = document.querySelector('#data-input').value;
    let name = document.querySelector('#name-input').value;
    let surl = document.querySelector('#surl-input').value;
    
    let res=await createGist(data,name,surl);
    if(res.error){
        document.querySelector("#create-result-bar").innerHTML = "ERROR";
        document.querySelector("#create-result-bar").style.backgroundColor = 'red';
        document.querySelector('#surl-output').value = `${res.text}`
    }else{
        document.querySelector("#create-result-bar").innerHTML = "OK";
        document.querySelector("#create-result-bar").style.backgroundColor = 'green';
        document.querySelector('#surl-output').value = `${location.origin}/${res.text}`
    }

}

function edit_gist(){
    location.href = "/?edit="+code;
}

async function fetchEdit(code){
    let res = await fetch('/raw/'+code);
    let data = await res.json();
    if(data === "undefined"){
        return;
    }
    document.querySelector("#data-input").value = data.content;
    document.querySelector("#name-input").value = data.name;
}