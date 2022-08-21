let admin = require("firebase-admin");
import {getFirestore} from "firebase-admin/firestore";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
let config = require("../config.json");

let serviceAccount = require('../firebase-secrets.json');

let defaultApp = initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:config.databaseURL
});

export const firebase_db = getFirestore(defaultApp);
export const realtime_db = admin.database();
export const firebase_auth = getAuth();
