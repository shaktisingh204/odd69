
require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.MYZOSH_API_URL || "https://staging.myzosh.com/api";
const AGENT_CODE = process.env.MYZOSH_AGENT_CODE || "kuberexch";
const SECRET_KEY = process.env.MYZOSH_SECRET_KEY || "f762624860655bda86c5e9eab1e845765ef6c757d4dd9894c8adfb959b6e23ea";
const STATIC_TOKEN = process.env.MYZOSH_STATIC_TOKEN;

function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return { error: 'Invalid JWT' };
    }
}

async function run() {
    console.log(`Agent: ${AGENT_CODE}`);
    console.log(`API: ${API_URL}`);

    // 1. Try with Static Token
    if (STATIC_TOKEN) {
        console.log('\n--- Testing Static Token ---');
        console.log('Token:', STATIC_TOKEN.substring(0, 20) + '...');
        console.log('Decoded:', decodeJwt(STATIC_TOKEN));
        try {
            const res = await axios.post(`${API_URL}/get_sports`, { access_token: STATIC_TOKEN });
            console.log('Static Token Result:', res.status, res.data?.status);
        } catch (e) {
            console.log('Static Token Failed:', e.response?.status, e.response?.data);
        }
    }

    // 2. Login
    console.log('\n--- Logging In ---');
    let dynamicToken = null;
    try {
        const res = await axios.post(`${API_URL}/get_access_token`, {
            agent_code: AGENT_CODE,
            secret_key: SECRET_KEY
        });
        if (res.data?.status?.code === 200) {
            dynamicToken = res.data.data.access_token;
            console.log('Login Success. Token:', dynamicToken.substring(0, 20) + '...');
            console.log('Decoded:', decodeJwt(dynamicToken));
        } else {
            console.log('Login Failed:', res.data);
            return;
        }
    } catch (e) {
        console.error('Login Error:', e.message);
        return;
    }

    // 3. Try with Dynamic Token
    if (dynamicToken) {
        console.log('\n--- Testing Dynamic Token ---');
        try {
            const res = await axios.post(`${API_URL}/get_sports`, { access_token: dynamicToken });
            console.log('Dynamic Token Result:', res.status, res.data?.status);
            console.log('Data Length:', res.data?.data?.length);
        } catch (e) {
            console.log('Dynamic Token Failed:', e.response?.status, e.response?.data);
        }
    }
}

run();
