// modules
const base64 = require("js-base64");
const brotli = require('brotli');
const https = require('https');
const http = require('http');
const Lame = require("node-lame").Lame;
const md5 = require("js-md5");
const mp3Duration = require("mp3-duration");
// vars
// firefox is good
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0";
const voices = require("./info").voices;
// stuff
const asset = require("../asset/main");
const get = require("../request/get");
const loadPost = require("../request/post_body");

function processVoice(voiceName, text) {
	return new Promise((res, rej) => {
		const voice = voices[voiceName];
		switch (voice.source) {
			case "polly": {
				// make sure it's under the char limit
				const stext = text.substring(0, 249);

				const body = JSON.stringify({
					"Engine": "standard",
					"Provider": voice.arg2,
					"SpeechName": voice.desc,
					"OutputFormat": "mp3",
					"VoiceId": voice.arg,
					"LanguageCode": voice.arg3,
					"charsCount": stext.length,
					"SampleRate": "24000",
					"effect": "default",
					"master_VC": "advanced",
					"speed": "0",
					"master_volume": "0",
					"pitch": "0",
					"Text": stext,
					"TextType": "text",
					"fileName": ""
				});
				var req = https.request(
					{
						hostname: "voicemaker.in",
						port: "443",
						path: "/voice/standard",
						method: "POST",
						headers: {
							"Accept": "application/json, text/javascript, */*; q=0.01",
							"Content-Length": body.length,
							"Content-Type": "application/json",
							"Host": "voicemaker.in",
							"Origin": "https://voicemaker.in",
							"Referer": "https://voicemaker.in/",
							"User-Agent": userAgent,
							"X-Requested-With": "XMLHttpRequest"
						}
					},
					(r) => {
						let buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => {
							const json = JSON.parse(Buffer.concat(buffers).toString());
							if (!json.success) rej(json.message);

							get(`https://voicemaker.in/${json.path}`)
								.then(res)
								.catch(err => rej(err));
						});
						r.on("error", rej);
					}
				);
				req.write(body);
				req.end();
				break;
			}
			/* WARNING: NUANCE TTS API HAS BACKGROUND MUSIC


			shut up xomdjl ~tetra
			*/
			case "nuance": {
				var q = new URLSearchParams({
					voice_name: voice.arg,
					speak_text: text,
				}).toString();
				https.get({
						host: "voicedemo.codefactoryglobal.com",
						path: `/generate_audio.asp?${q}`,
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => res(Buffer.concat(buffers)));
						r.on("error", rej);
					}
				);
				break;
			}
			case "cepstral": {
				https.get('https://www.cepstral.com/en/demos', r => {
					const cookie = r.headers['set-cookie'];
					var q = new URLSearchParams({
						voiceText: text,
						voice: voice.arg,
						createTime: 666,
						rate: 170,
						pitch: 1,
						sfx: 'none',
					}).toString();
					var buffers = [];
					var req = https.get({
						host: 'www.cepstral.com',
						path: `/demos/createAudio.php?${q}`,
						headers: { Cookie: cookie },
						method: 'GET',
					}, r => {
						r.on('data', b => buffers.push(b));
						r.on('end', () => {
							var json = JSON.parse(Buffer.concat(buffers));
							get(`https://www.cepstral.com${json.mp3_loc}`).then(res).catch(rej);
						})
					});
				});
				break;
			}
			case "vocalware": {
				var [eid, lid, vid] = voice.arg;
				var cs = md5(`${eid}${lid}${vid}${text}1mp35883747uetivb9tb8108wfj`);
				var q = new URLSearchParams({
					EID: voice.arg[0],
					LID: voice.arg[1],
					VID: voice.arg[2],
					TXT: text,
					EXT: "mp3",
					IS_UTF8: 1,
					ACC: 5883747,
					cache_flag: 3,
					CS: cs,
				}).toString();
				var req = https.get(
					{
						host: "cache-a.oddcast.com",
						path: `/tts/gen.php?${q}`,
						headers: {
							Referer: "https://www.oddcast.com/",
							Origin: "https://www.oddcast.com/",
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
						},
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => res(Buffer.concat(buffers)));
						r.on("error", rej);
					}
				);
				break;
			}
			/* case "acapela": {
				var buffers = [];
				var acapelaArray = [];
				for (var c = 0; c < 15; c++) acapelaArray.push(~~(65 + Math.random() * 26));
				var email = `${String.fromCharCode.apply(null, acapelaArray)}@gmail.com`;
				var req = https.request(
					{
						hostname: "acapelavoices.acapela-group.com",
						path: "/index/getnonce",
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
					},
					(r) => {
						r.on("data", (b) => buffers.push(b));
						r.on("end", () => {
							var nonce = JSON.parse(Buffer.concat(buffers)).nonce;
							var req = http.request(
								{
									hostname: "acapela-group.com",
									port: "8080",
									path: "/webservices/1-34-01-Mobility/Synthesizer",
									method: "POST",
									headers: {
										"Content-Type": "application/x-www-form-urlencoded",
									},
								},
								(r) => {
									var buffers = [];
									r.on("data", (d) => buffers.push(d));
									r.on("end", () => {
										const html = Buffer.concat(buffers);
										const beg = html.indexOf("&snd_url=") + 9;
										const end = html.indexOf("&", beg);
										const sub = html.subarray(beg, end).toString();
										http.get(sub, (r) => {
											r.on("data", (d) => buffers.push(d));
											r.on("end", () => {
												res(Buffer.concat(buffers));
											});
										});
									});
									r.on("error", rej);
								}
							);
							req.end(
								new URLSearchParams({
									req_voice: voice.arg,
									cl_pwd: "",
									cl_vers: "1-30",
									req_echo: "ON",
									cl_login: "AcapelaGroup",
									req_comment: `{"nonce":"${nonce}","user":"${email}"}`,
									req_text: text,
									cl_env: "ACAPELA_VOICES",
									prot_vers: 2,
									cl_app: "AcapelaGroup_WebDemo_Android",
								}).toString()
							);
						});
					}
				);
				req.end(
					new URLSearchParams({
						json: `{"googleid":"${email}"`,
					}).toString()
				);
				break;
			} */
			case "acapela": {
				var buffers = [];
				var acapelaArray = [];
				for (var c = 0; c < 15; c++) acapelaArray.push(~~(65 + Math.random() * 26));
				var email = `${String.fromCharCode.apply(null, acapelaArray)}@gmail.com`;
				var req = https.request(
					{
						hostname: "acapelavoices.acapela-group.com",
						path: "/index/getnonce",
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
					},
					(r) => {
						r.on("data", (b) => buffers.push(b));
						r.on("end", () => {
							var nonce = JSON.parse(Buffer.concat(buffers)).nonce;
							var req = http.request(
								{
									hostname: "acapela-group.com",
									port: "8080",
									path: "/webservices/1-34-01-Mobility/Synthesizer",
									method: "POST",
									headers: {
										"Content-Type": "application/x-www-form-urlencoded",
									},
								},
								(r) => {
									var buffers = [];
									r.on("data", (d) => buffers.push(d));
									r.on("end", () => {
										const html = Buffer.concat(buffers);
										const beg = html.indexOf("&snd_url=") + 9;
										const end = html.indexOf("&", beg);
										const sub = html.subarray(beg, end).toString();
										http.get(sub, (r) => {
											r.on("data", (d) => buffers.push(d));
											r.on("end", () => {
												res(Buffer.concat(buffers));
											});
										});
									});
									r.on("error", rej);
								}
							);
							req.end(
								new URLSearchParams({
									req_voice: voice.arg,
									cl_pwd: "",
									cl_vers: "1-30",
									req_echo: "ON",
									cl_login: "AcapelaGroup",
									req_comment: `{"nonce":"${nonce}","user":"${email}"}`,
									req_text: text,
									cl_env: "ACAPELA_VOICES",
									prot_vers: 2,
									cl_app: "AcapelaGroup_WebDemo_Android",
								}).toString()
							);
						});
					}
				);
				req.end(
					new URLSearchParams({
						json: `{"googleid":"${email}"`,
					}).toString()
				);
				break;
			}
			case "acapelaOld": {
				var q = new URLSearchParams({
					inputText: base64.encode(text),
				}).toString();
				https.get(
					{
						host: "voice.reverso.net",
						path: `/RestPronunciation.svc/v1/output=json/GetVoiceStream/voiceName=${voice.arg}?${q}`,
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => res(Buffer.concat(buffers)));
						r.on("error", rej);
					}
				);
				break;
			}
			case "voiceforge": {
				var q = new URLSearchParams({
					"HTTP-X-API-KEY": "9a272b4",
					msg: text,
					voice: voice.arg,
					email: null
				}).toString();
				let url = `https://api.voiceforge.com/swift_engine?${q}`;
				https.get(url, (r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => {
							const encoder = new Lame({
								"output": "buffer",
								"bitrate": 192
							}).setBuffer(Buffer.concat(buffers));

							encoder.encode()
								.then(() => {
									const buffer = encoder.getBuffer();
									res(buffer);
								})
								.catch(err => rej(err));
						});
						r.on("error", rej);
					}
				);
				break;
			}
			case "svox": {
				var q = new URLSearchParams({
					apikey: "e3a4477c01b482ea5acc6ed03b1f419f",
					action: "convert",
					format: "mp3",
					voice: voice.arg,
					speed: 0,
					text: text,
					version: "0.2.99",
				}).toString();
				https.get(
					{
						host: "api.ispeech.org",
						path: `/api/rest?${q}`,
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => res(Buffer.concat(buffers)));
						r.on("error", rej);
					}
				);
				break;
			}
			/*
			case "acapela": {
				var q = new URLSearchParams({
					cl_login: "VAAS_MKT",
					req_snd_type: "",
					req_voice: voice.arg,
					cl_app: "seriousbusiness",
					req_text: text,
					cl_pwd: "M5Awq9xu",
				}).toString();
				http.get(
					{
						host: "vaassl3.acapela-group.com",
						path: `/Services/AcapelaTV/Synthesizer?${q}`,
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => {
							const html = Buffer.concat(buffers);
							const beg = html.indexOf("&snd_url=") + 9;
							const end = html.indexOf("&", beg);
							const sub = html.subarray(beg + 4, end).toString();
							if (!sub.startsWith("://")) return rej();
							get(`https${sub}`).then(res).catch(rej);
						});
						r.on("error", rej);
					}
				);
				break;
			}
			*/
			case "readloud": {
				const req = https.request(
					{
						host: "readloud.net",
						port: 443,
						path: voice.arg,
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36",
						},
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => {
							const html = Buffer.concat(buffers);
							const beg = html.indexOf("/tmp/");
							const end = html.indexOf(".mp3", beg) + 4;
							const sub = html.subarray(beg, end).toString();
							const loc = `https://readloud.net${sub}`;

							https.get(
								{
									host: "readloud.net",
									path: sub,
									headers: {
										"Content-Type": "application/x-www-form-urlencoded",
										"User-Agent":
											"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36",
									},
								},
								(r) => {
									buffers = [];
									r.on("data", (d) => buffers.push(d));
									r.on("end", () => res(Buffer.concat(buffers)));
								}
							);
						});
						r.on("error", rej);
					}
				);
				req.end(
					new URLSearchParams({
						but1: text,
						butS: 0,
						butP: 0,
						butPauses: 0,
						but: "Submit",
					}).toString()
				);
				break;
			}
			case "cereproc": {
				const req = https.request(
					{
						hostname: "www.cereproc.com",
						path: "/themes/benchpress/livedemo.php",
						method: "POST",
						headers: {
							"content-type": "text/xml",
							"accept-encoding": "gzip, deflate, br",
							origin: "https://www.cereproc.com",
							referer: "https://www.cereproc.com/en/products/voices",
							"x-requested-with": "XMLHttpRequest",
							cookie: "Drupal.visitor.liveDemo=666",
						},
					},
					(r) => {
						var buffers = [];
						r.on("data", (d) => buffers.push(d));
						r.on("end", () => {
							const xml = String.fromCharCode.apply(null, brotli.decompress(Buffer.concat(buffers)));
							const beg = xml.indexOf("<url>") + 5;
							const end = xml.lastIndexOf("</url>");
							const loc = xml.substring(beg, end).toString();
							get(loc).then(res).catch(rej);
						});
						r.on("error", rej);
					}
				);
				req.end(
					`<speakExtended key='666'><voice>${voice.arg}</voice><text>${text}</text><audioFormat>mp3</audioFormat></speakExtended>`
				);
				break;
			}
			case "google": {
				let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&total=1&idx=0&textlen=${text.length}&client=tw-ob`;
				https.get(url, (r) => {
					var buffers = [];
					r.on("data", (d) => buffers.push(d));
					r.on("end", () => res(Buffer.concat(buffers)));
					r.on("error", rej);
				});
			}
		}
	});
}

module.exports = function (req, res, url) {
	if (req.method != 'POST' || url.path != '/goapi/convertTextToSoundAsset/') return;
	loadPost(req, res).then(data => {
		processVoice(data.voice, data.text).then(buffer => {
			mp3Duration(buffer, (e, duration) => {
				if (e || !duration) return res.end(1 + process.env.FAILURE_XML);

				const meta = {
					type: "sound",
					subtype: "tts",
					title: `[${voices[data.voice].desc}] ${data.text}`,
					duration: 1e3 * duration,
					ext: "mp3",
					tId: "ugc"
				}
				const id = asset.save(buffer, meta);
				res.end(`0<response><asset><id>${id}.mp3</id><enc_asset_id>${id}</enc_asset_id><type>sound</type><subtype>tts</subtype><title>${meta.title}</title><published>0</published><tags></tags><duration>${meta.duration}</duration><downloadtype>progressive</downloadtype><file>${id}.mp3</file></asset></response>`)
			});
		}).catch(e => {
			console.log("Error generating TTS: " + e);
			res.end(process.env.FAILURE_XML);
		});
	});
	return true;
}
