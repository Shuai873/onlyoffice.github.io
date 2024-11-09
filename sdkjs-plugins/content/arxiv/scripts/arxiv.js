/**
 *
 * (c) Copyright Ascensio System SIA 2020
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
(function () {
    // Ensure the Asc object and plugin namespace are initialized
    if (!window.Asc) window.Asc = {};
    if (!window.Asc.plugin) window.Asc.plugin = {};
    if (!window.Asc.plugin.arxiv) window.Asc.plugin.arxiv = {};

    window.Asc.plugin.arxiv.api = function (cfg) {
        var baseUrl = cfg.baseUrl || "http://export.arxiv.org/api/";

        function getRequest(url) {
            return new Promise(function (resolve, reject) {
                fetch(url).then(function (res) {
                    if (!res.ok) throw new Error(res.status + " " + res.statusText);
                    return res.text();
                }).then(function (text) {
                    resolve(text);
                }).catch(function (err) {
                    reject(err);
                });
            });
        }

        function buildGetRequest(query, page = 0) {
            var url = new URL(baseUrl + "query");
            url.searchParams.append("search_query", query);
            var start = page * 10;
            url.searchParams.append("start", start);
            url.searchParams.append("max_results", 10);
            return getRequest(url);
        }

        function search(query, page = 0) {
            return new Promise(function (resolve, reject) {
                parseResponse(buildGetRequest(query, page), resolve, reject);
            });
        }

        function parseResponse(promise, resolve, reject) {
            promise.then(function (text) {
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(text, "text/xml");
                
                var totalResults = parseInt(xmlDoc.getElementsByTagName("opensearch:totalResults")[0].textContent);
                
                var entries = xmlDoc.getElementsByTagName("entry");
                var items = Array.from(entries).map(entry => {
                    // Get primary category
                    var primaryCategory = entry.getElementsByTagName("arxiv:primary_category")[0];
                    var category = primaryCategory ? primaryCategory.getAttribute("term") : null;

                    // Get update date
                    var updated = entry.getElementsByTagName("updated")[0];
                    var updatedDate = updated ? updated.textContent : null;

                    return {
                        id: entry.getElementsByTagName("id")[0].textContent,
                        title: entry.getElementsByTagName("title")[0].textContent,
                        summary: entry.getElementsByTagName("summary")[0].textContent,
                        author: Array.from(entry.getElementsByTagName("author")).map(author => ({
                            name: author.getElementsByTagName("name")[0].textContent
                        })),
                        published: entry.getElementsByTagName("published")[0].textContent,
                        updated: updatedDate,
                        primaryCategory: category,
                        link: entry.getElementsByTagName("link")[0].getAttribute("href")
                    };
                });

                resolve({ 
                    items: items,
                    totalResults: totalResults,
                    currentPage: Math.floor(parseInt(xmlDoc.getElementsByTagName("opensearch:startIndex")[0].textContent) / 10)
                });
            }).catch(function (err) {
                reject(err);
            });
        }

        function convertToCSL(item) {
            // 提取 arXiv ID
            var arxivId = item.id.split('/').pop().replace('arxiv.org/abs/', '');
            
            // 构建更完整的 CSL 数据
            var cslData = {
                id: item.id,
                title: item.title,
                
                // 更好地处理作者名字
                author: item.author.map(a => {
                    let nameParts = a.name.trim().split(' ');
                    return {
                        family: nameParts.pop(), // 姓氏
                        given: nameParts.join(' '), // 名字
                        literal: a.name // 完整名字
                    };
                }),

                // 添加更多日期相关信息
                issued: { 'date-parts': [[new Date(item.published).getFullYear()]] },
                accessed: { 'date-parts': [[new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]] },
                
                // arXiv 特定字段
                'container-title': 'arXiv',
                'publisher': 'arXiv',
                'archive': 'arXiv',
                'archive_location': arxivId,
                'genre': 'preprint',
                
                // 分类信息
                'collection-title': item.primaryCategory,
                
                // URL 和 abstract
                URL: item.link,
                abstract: item.summary,
                
                // 文档类型
                type: 'article-journal',
                
                // 版本信息
                version: item.updated ? new Date(item.updated).toISOString() : undefined,
                
                // 标识符
                DOI: `arXiv:${arxivId}`,
                
                // 语言 (arXiv 默认为英语)
                language: 'en'
            };

            return cslData;
        }

        return {
            search: search,
            convertToCSL: convertToCSL
        }
    }
})();
