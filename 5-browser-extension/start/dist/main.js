// 5-browser-extension/start/dist/main.js
const form = document.querySelector('.form-data');
const region = document.querySelector('.region-name');
const apiKey = document.querySelector('.api-key');
const errors = document.querySelector('.errors');
const loading = document.querySelector('.loading');
const results = document.querySelector('.result-container');
const clearBtn = document.querySelector('.clear-btn');

function init() {
	const storedApiKey = localStorage.getItem('apiKey');
	const storedRegion = localStorage.getItem('regionName');

	if (storedApiKey === null || storedRegion === null) {
		if (form) form.style.display = 'block';
		if (results) results.style.display = 'none';
		if (loading) loading.style.display = 'none';
		if (clearBtn) clearBtn.style.display = 'none';
		if (errors) errors.textContent = '';
	} else {
		displayCarbonUsage(storedApiKey, storedRegion);
	}
}

function reset(e) {
	if (e) e.preventDefault();
	localStorage.removeItem('regionName');
	localStorage.removeItem('apiKey');
	init();
}

function handleSubmit(e) {
	if (e) e.preventDefault();
	if (apiKey && region) {
		setUpUser(apiKey.value, region.value);
	}
}

function setUpUser(apiKeyVal, regionNameVal) {
	localStorage.setItem('apiKey', apiKeyVal);
	localStorage.setItem('regionName', regionNameVal);
	displayCarbonUsage(apiKeyVal, regionNameVal);
}

function displayCarbonUsage(apiKeyVal, regionNameVal) {
	if (loading) loading.style.display = 'none';
	if (form) form.style.display = 'none';
	if (results) results.style.display = 'block';
	if (clearBtn) clearBtn.style.display = 'block';

	const myRegion = document.querySelector('.my-region');
	const carbonUsage = document.querySelector('.carbon-usage');
	const fossilFuel = document.querySelector('.fossil-fuel');

	if (myRegion) myRegion.textContent = regionNameVal;
	if (carbonUsage) carbonUsage.textContent = '120 gCO2eq/kWh';
	if (fossilFuel) fossilFuel.textContent = '24.5%';
}

if (form) {
	form.addEventListener('submit', handleSubmit);
}

if (clearBtn) {
	clearBtn.addEventListener('click', reset);
}

init();
