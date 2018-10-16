/**
 * 大连理工大学开发区校区官网通知公告抓取模块
 *
 * @Author lcr
 * @CreateDate 18-9-5
 */

const request = require('superagent');
const cheerio = require('cheerio');
const newsType = require('../config/config').type;

const base = 'http://math.dlut.edu.cn';
const firstPage = '/xsgz_b_1/tzgg.htm'; //新闻首页

let db = require('../models/index');
let news = db.models.News;

function getNoticeTitleAndUrl(url) {
    return new Promise((resolve, reject) => {
        request
            .get(url)
            .end((err, res) => {
                if (err) {
                    reject(err.toString());
                } else {
                    let $ = cheerio.load(res.text);
                    let data = [];
                    let html = $('div.ny_about');
                    let i = 0;
                    html.find('li').each((index, element) => {
                        if(element.children[1].next.attribs.href[0] === '.'){
                            data.push({
                                name: element.children[1].next.attribs.title,
                                url: base + /(\/info[\s\S]{0,200})/.exec(element.children[1].next.attribs.href)[1]
                            })
                        }else{
                            data.push({
                                name: element.children[1].next.attribs.title,
                                url:  element.children[1].next.attribs.href
                            })
                        }
                    });

                    html.find('a.Next').each((index, element) => {
                        if (element.children[0].data === '下页') {
                            data.push({
                                next: base + '/xsgz_b_1/tzgg/' + /[\s\S]{0,200}([0-9]{1,10}.htm)$/.exec(element.attribs.href)[1]
                            })
                        }
                    });
                    resolve(data);
                }
            });
    });
}

function getAllData(data) {
    return new Promise((resolve, reject) => {
        request
            .get(data.url)
            .end((err, res) => {
                if (err) {
                    reject(err.toString());
                } else {
                    let $ = cheerio.load(res.text);
                    let header = $('form[name=_newscontent_fromname] > div');
                    let value = {};
                    value.title = header. find('h1')[0].children[0].data;
                    //console.log(value.title);
                    console.log(header.find('div')[0].children[0].data);
                    let temp_str = header.find('div')[0].children[0].data;
                    let end = temp_str.indexOf(':') + 3;
                    header.find('div')[0].children[0].data.substring(0 , end);

                    value.dateStr = header.find('div')[0].children[0].data.substring(0 , end);;
                    value.from = header.find('div')[0].children[0].data.substring(end);
                    value.url = data.url;
                    value.time = new Date();
                    console.log(value);
                    //该项为原始通知部分网页，若有图片应注意图片的src需添加前缀，同时应该去除所有标签class,开发区校区通知不需要故而省去，只执行添加附件
                    let content = $('div#vsb_content');
                    let files = $('form[name=_newscontent_fromname] > ul');
                    files.find('li').each((index, element) => {
                        let temp = element.children[1].attribs.href;
                        element.children[1].attribs.href = base + temp;
                    });
                    //content.append(files.html());
                    let file = [];
                    if (files.length > 0) {
                        files[0].children.forEach(element => {
                            if (element.name === 'li') {
                                file.push({
                                    link: element.children[1].attribs.href,
                                    fileName: element.children[1].children[0].data
                                })
                            }
                        });
                    }
                    value.body = content.html();
                    value.fileLinks = file;
                    value.type = newsType.EDANotice;
                    value.clickCount = 0;
                    news.count({
                        where: {
                            title: value.title
                        }
                    }).then(value1 => {
                        if (value1 === 0) {
                            news.create(value).then(() => {
                                resolve(true)
                            }).catch((error => {
                                reject(error.toString());
                            }));
                        } else {
                            news.find({
                                where: {
                                    title: value.title
                                }
                            }).then(value2 => {
                                value2.update(value).then(() => {
                                    resolve(true)
                                }).catch((error => {
                                    reject(error.toString());
                                }));
                            })
                        }
                    }).catch(error => {
                        reject(error.toString())
                    });
                }
            })
    });
}

async function start(url) {
    let value = await getNoticeTitleAndUrl(url);
    for (let element of value) {

        if (element.hasOwnProperty('next')) {
            await start(element.next);

        } else {
            await getAllData(element);
        }/*else{
            await
        }*/
    }
}

module.exports = async function run() {
    await start(base + firstPage);
};
