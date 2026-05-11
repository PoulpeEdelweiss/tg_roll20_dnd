
const axios = require('axios');

const BASE_URL = 'https://www.dnd5eapi.co/api';

const API_ENDPOINTS = {
    spells: '/spells',
    classes: '/classes',
    races: '/races',
    monsters: '/monsters',
    magicItems: '/magic-items'
};

const fetchList = async (endpoint, page = 1) => {
    const LIMIT = 10;
    const { data } = await axios.get(`${BASE_URL}${endpoint}`, {
        params: {
            limit: LIMIT,
            offset: (page - 1) * LIMIT
        }
    });
    return data;
};

const fetchItemDetails = async (endpoint, index) => {
    const { data } = await axios.get(`${BASE_URL}/${endpoint}/${index}`);
    return data;
};

const searchSpell = async (query) => {
    const { data } = await axios.get(`${BASE_URL}/spells`, {
        params: { name: query }
    });
    return data;
};

module.exports = {
    fetchList,
    fetchItemDetails,
    searchSpell,
    API_ENDPOINTS
};