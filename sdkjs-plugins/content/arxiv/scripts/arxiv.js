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
                var items = Array.from(entries).map(entry => ({
                    id: entry.getElementsByTagName("id")[0].textContent,
                    title: entry.getElementsByTagName("title")[0].textContent,
                    summary: entry.getElementsByTagName("summary")[0].textContent,
                    author: Array.from(entry.getElementsByTagName("author")).map(author => ({
                        name: author.getElementsByTagName("name")[0].textContent
                    })),
                    published: entry.getElementsByTagName("published")[0].textContent,
                    link: entry.getElementsByTagName("link")[0].getAttribute("href")
                }));

                resolve({ 
                    items: items,
                    totalResults: totalResults,
                    currentPage: Math.floor(parseInt(xmlDoc.getElementsByTagName("opensearch:startIndex")[0].textContent) / 10)
                });
            }).catch(function (err) {
                reject(err);
            });
        }

        return {
            search: search
        }
    }
})();
