const http = require('http');			// Http 服务器 API
const fs = require('fs');				// 处理本地文件
const os = require('os');				// 获取本地 IP 地址
const exec = require('child_process').exec;			// 
const path = require('path');						// 用于处理路径和后缀
const url = require('url');							// 用于解析 get 请求所带的参数
const zlib = require('zlib');

const config = require('./config/default');			//
const mime = require('./mime');


function respondNotFound(req, res) {
	res.writeHead(404, {
		'Content-Type': 'text/html'
	});
	res.end(`<h1>Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p>`);
}

function respondDirectory(pathName, req, res) {
	fs.readdir(pathName, (err, files) => {
		if (err) {
			res.writeHead(500);
			return res.end(err);
		}

		const requestPath = url.parse(req.url).pathname;
		let content = `<h1>Index of ${requestPath}</h1>`;

		files.forEach(file => {
			let itemLink = path.join(requestPath, file);
			const stat = fs.statSync(path.join(pathName, file));
			if (stat && stat.isDirectory()) {
				itemLink = path.join(itemLink, path.sep);
			}
			content += `<p><a href='${itemLink}'>${file}</a></p>`;
		});
		res.writeHead(200, {
			'Content-Type': 'text/html'
		});
		res.end(content);
	});
}

function respondRedirect(req, res) {
	const location = req.url + path.sep;
	res.writeHead(301, {
		'Location': location,
		'Content-Type': 'text/html'
	});
	res.end(`Redirecting to <a href='${location}'>${location}</a>`);
}

function responseFile(pathName, req, res) {
	const readStream = fs.createReadStream(pathName);
	res.setHeader('Content-Type', mime.lookup(pathName));
	const extname = path.extname(pathName);
	const zipMatch = new RegExp(config.zipMatch);
	if (zipMatch.test(extname)) {
		compressHandler(readStream, req, res).pipe(res);
	} else {
		readStream.pipe(res);
	}
	
}

function compressHandler(readStream, req, res) { 
	const acceptEncoding = req.headers['accept-encoding']; 
	if (!acceptEncoding || !acceptEncoding.match(/\b(gzip|deflate)\b/)) { 
		return readStream; 
	} else if (acceptEncoding.match(/\bgzip\b/)) { 
		res.setHeader('Content-Encoding', 'gzip'); 
		return readStream.pipe(zlib.createGzip()); 
	} else if (acceptEncoding.match(/\bdeflate\b/)) { 
		res.setHeader('Content-Encoding', 'deflate'); 
		return readStream.pipe(zlib.createDeflate()); 
	} 
}


function responseNotModified(res) {
	res.writeHead(304);
	res.end();
}

function isFresh(reqHeaders, resHeaders) {
	const noneMatch = reqHeaders['if-none-match'];
	const lastModified = reqHeaders['if-modified-since'];

	if (!(noneMatch || lastModified)) {	
		return false;
	}
	if (noneMatch && (noneMatch !== resHeaders['etag'])) {
		return false;
	}
	if (lastModified && lastModified !== resHeaders['last-modified']) {
		return false;
	}
	return true;
}

function setFreshHeaders(stat, res) {
	const lastModified = stat.mtime.toUTCString();
	if (config.expires) {
		const expiresTime = (new Date(Date.now() + config.maxAge * 1000)).toUTCString();
		res.setHeader('Expires', expiresTime);
	}
	if (config.cacheControl) {
		res.setHeader('Cache-Control', `public, max-age=${config.maxAge}`);
	}
	if (config.lastModified) {
		res.setHeader('Last-Modified', lastModified);
	}
	if (config.etag) {
		const mtime = stat.mtime.getTime().toString(16);
		const size = stat.size.toString(16);
		const etag = `W/"${size}-${mtime}"`;
		res.setHeader('ETag', etag);
	}
}

function respond(pathName, req, res) {
	fs.stat(pathName, (err, stat) => {
		if (err) {
			res.writeHead(404);
			return res.end(err);
		}

		setFreshHeaders(stat, res);
		if(isFresh(req.headers, res._headers)) {
			responseNotModified(res);
		} else {
			responseFile(pathName, req, res);
		}
	});
}

function respondHandler(pathName, stat, req, res) {
	const requestedPath = url.parse(req.url).pathname;
	const hasTrailingSlash = requestedPath.slice(requestedPath.length - 1) == '/';

	if (hasTrailingSlash && stat.isDirectory()) {
		respondDirectory(pathName, req, res);
	} else if (stat.isDirectory()) {
		respondRedirect(req, res);
	} else {
		respond(pathName, req, res);
	}
}

function routeHandler(pathName, req, res) {
	fs.stat(pathName, (err, stat) => {
		if (!err) {
			respondHandler(pathName, stat, req, res);
		} else {
			respondNotFound(req, res)
		}
	})
}

class StaticServer {
	constructor() {
		this.port = config.port;
		this.root = __dirname;
	}

	start() {
		http.createServer((req, res) => {
			const pathName = path.join(this.root, path.normalize(req.url));
			routeHandler(pathName, req, res);
		}).listen(this.port, err => {
			if (err) {
				console.error(err);
				console.info('Failed to start server');
			} else {
				console.info(`Server started on port ${this.port}`);
			}
		})
	}




}





console.log(__dirname);



module.exports = StaticServer;