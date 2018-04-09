const path = require('path');

const mimeType = {
	"css": "text/css",
	"gif": "image/gif",
	"html": "text/html",
	"ico": "image/x-ico",
	"jpeg": "image/jpeg",
	"png": "image/png",
	"txt": "text/plain"
};

const lookup = (pathName) => {
	let ext = path.extname(pathName);
	ext = ext.split('.').pop();
	return mimeType[ext] || mimeType['txt'];
};

module.exports = { lookup };