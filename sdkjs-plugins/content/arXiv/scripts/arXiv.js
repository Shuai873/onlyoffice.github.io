console.log('arXiv.js loaded');
console.log('window.Asc exists:', !!window.Asc);

(function(window, undefined) {
    'use strict';

    let papers = [];
    let Cite;
    let currentStart = 0;
    let resultsPerPage = 10;
    let totalResults = 0;

    window.Asc.plugin.init = function() {
        console.log('Plugin init called');
        
        try {
            if (window.Cite) {
                console.log('Citation.js is available');
                Cite = window.Cite;
                initializePlugin();
            } else {
                console.error('Citation.js is not available');
                $('#error-message').text('引用库未加载，请刷新页面重试。').show();
            }
        } catch (error) {
            console.error('Error initializing plugin:', error);
            $('#error-message').text('插件初始化失败，请刷新页面重试。').show();
        }
    };

    function initializePlugin() {
        console.log('Initializing plugin');
        try {
            // 移除现有的事件监听器
            $('#search-button').off('click');
            $('#search-input').off('keypress');
            $('#addEditCitationBtn').off('click');
            $('#addBibliographyBtn').off('click');
            $('#refreshBtn').off('click');

            // 添加新的事件监听器
            $('#search-button').on('click', performSearch);
            $('#search-input').keypress(function(e) {
                if (e.which == 13) {
                    performSearch();
                }
            });
            $('#addEditCitationBtn').on('click', addEditCitation);
            $('#addBibliographyBtn').on('click', addBibliography);
            $('#refreshBtn').on('click', refreshCitations);

            // 添加摘要显示/隐藏功能
            $('input[name="abstracts"]').on('change', function() {
                if (this.id === 'hide-abstracts') {
                    $('.mathjax').hide();
                } else {
                    $('.mathjax').show();
                }
            });

            $('#error-message').hide();
            console.log('Plugin initialized successfully');

            $('.search-form').off('submit').on('submit', handleSearchSubmit);

            $('#results-per-page').on('change', function() {
                resultsPerPage = parseInt($(this).val());
                currentStart = 0;
                performSearch();
            });
        } catch (error) {
            console.error('Error in initializePlugin:', error);
            $('#error-message').text('插件初始化失败，请刷新页面重试。').show();
        }
    }

    function performSearch(event) {
        if (event) event.preventDefault();
        console.log('Performing search...');
        $('#loading-indicator').show();
        $('#results-container').empty();
        $('#error-message').hide();

        // 如果是新搜索,重置起始位置
        if (event) currentStart = 0;

        var searchField = $('#search-field').val();
        var query = $('#search-input').val().trim();
        var sortBy = $('#sort-by').val();
        var sortOrder = $('#sort-order').val();
        var showAbstracts = $('#show-abstracts').is(':checked');

        if (!query) {
            $('#error-message').text('请输入搜索关键词').show();
            $('#loading-indicator').hide();
            return;
        }

        console.log('Search query:', query);

        // 构建 arXiv API 查询 URL
        var apiUrl = 'https://export.arxiv.org/api/query?';
        var searchQuery = '';

        // 根据选择的搜索字段构建查询
        switch(searchField) {
            case 'all':
                searchQuery = 'all:' + query;
                break;
            case 'title':
                searchQuery = 'ti:' + query;
                break;
            case 'author':
                searchQuery = 'au:' + query;
                break;
            case 'abstract':
                searchQuery = 'abs:' + query;
                break;
            case 'comments':
                searchQuery = 'co:' + query;
                break;
            case 'journal_ref':
                searchQuery = 'jr:' + query;
                break;
            case 'acm_class':
                searchQuery = 'acm:' + query;
                break;
            case 'msc_class':
                searchQuery = 'msc:' + query;
                break;
            case 'report_num':
                searchQuery = 'rn:' + query;
                break;
            case 'paper_id':
                searchQuery = 'id:' + query;
                break;
            case 'doi':
                searchQuery = 'doi:' + query;
                break;
            case 'orcid':
                searchQuery = 'orcid:' + query;
                break;
            case 'author_id':
                searchQuery = 'aid:' + query;
                break;
            case 'help':
                searchQuery = 'help:' + query;
                break;
            case 'full_text':
                searchQuery = 'ft:' + query;
                break;
        }

        apiUrl += 'search_query=' + encodeURIComponent(searchQuery);

        // 添加排序参数
        if (sortBy !== 'relevance') {
            apiUrl += '&sortBy=' + sortBy;
            apiUrl += '&sortOrder=' + sortOrder;
        }

        // 修改API URL,添加分页参数
        apiUrl += '&start=' + currentStart + '&max_results=' + resultsPerPage;

        console.log('API URL:', apiUrl);

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.text();
            })
            .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
            .then(data => {
                displayResults(data, showAbstracts);
            })
            .catch(error => {
                console.error('Search error:', error);
                $('#error-message').text('搜索时发生错误：' + error.message).show();
                $('#results-container').html('<p>搜索失败。请稍后再试。</p>');
            })
            .finally(() => {
                $('#loading-indicator').hide();
            });
    }

    function displayResults(data, showAbstracts) {
        console.log('显示结果...');
        papers = [];
        var results = '<dl>';
        var entries = data.getElementsByTagName('entry');
        console.log('找到的条目数量:', entries.length);

        // 获取总结果数
        totalResults = parseInt(data.getElementsByTagName('opensearch:totalResults')[0].textContent);

        if (entries.length === 0) {
            results += '<dt>没有找到匹配的结果。</dt>';
        } else {
            Array.from(entries).forEach((entry, index) => {
                var title = entry.getElementsByTagName('title')[0].textContent;
                var authors = Array.from(entry.getElementsByTagName('author')).map(author => {
                    var name = author.getElementsByTagName('name')[0].textContent;
                    var affiliation = author.getElementsByTagName('arxiv:affiliation')[0]?.textContent || '';
                    return { name, affiliation };
                });
                var summary = entry.getElementsByTagName('summary')[0].textContent;
                var link = Array.from(entry.getElementsByTagName('link')).find(link => 
                    link.getAttribute('title') === 'pdf'
                )?.getAttribute('href');
                var id = entry.getElementsByTagName('id')[0].textContent.split('/').pop();
                var published = new Date(entry.getElementsByTagName('published')[0].textContent);
                var updated = new Date(entry.getElementsByTagName('updated')[0].textContent);
                var categories = Array.from(entry.getElementsByTagName('category')).map(cat => cat.getAttribute('term'));
                var comments = entry.getElementsByTagName('arxiv:comment')[0]?.textContent || '';
                var journalRef = entry.getElementsByTagName('arxiv:journal_ref')[0]?.textContent || '';
                var doi = entry.getElementsByTagName('arxiv:doi')[0]?.textContent || '';

                console.log('Processing entry:', index, 'Title:', title);

                var primaryCategory = entry.getElementsByTagName('arxiv:primary_category')[0]?.getAttribute('term') || '';
                var mscClass = entry.getElementsByTagName('arxiv:msc-class')[0]?.textContent || '';
                var acmClass = entry.getElementsByTagName('arxiv:acm-class')[0]?.textContent || '';
                var reportNo = entry.getElementsByTagName('arxiv:report-no')[0]?.textContent || '';
                var license = entry.getElementsByTagName('arxiv:license')[0]?.textContent || '';
                var version = entry.getElementsByTagName('arxiv:version')[0]?.textContent || '1';
                var psLink = Array.from(entry.getElementsByTagName('link')).find(link => 
                    link.getAttribute('title') === 'ps'
                )?.getAttribute('href');

                papers.push({ title, authors, id, summary, link, published, updated, categories, comments, journalRef, doi });

                results += '<dt>';
                results += '<div class="paper-header">';
                results += '<input type="checkbox" id="' + id + '" name="paper">';
                results += '<label for="' + id + '">';
                results += '<span class="list-identifier">';
                results += '<a href="https://arxiv.org/abs/' + id + '" target="_blank">arXiv:' + id + '</a>';
                results += ' [<a href="' + link + '" target="_blank">pdf</a>, <a href="https://arxiv.org/format/' + id + '" target="_blank">other</a>]';
                results += '</span>';
                results += ' <span class="list-category">' + primaryCategory + '</span>';
                results += '</label>';
                results += '</div>';
                results += '<div class="paper-details">';
                results += '<div class="list-title">' + title + '</div>';
                results += '<div class="list-authors">' + authors.map(author => 
                    '<a href="https://arxiv.org/search/?searchtype=author&query=' + 
                    encodeURIComponent(author.name) + 
                    '" target="_blank">' + 
                    author.name + 
                    '</a>' + 
                    (author.affiliation ? ' (' + author.affiliation + ')' : '')
                ).join(', ') + '</div>';
                results += '</div>';
                results += '</dt>';
                results += '<dd>';
                if (showAbstracts) {
                    results += '<p class="mathjax">' + summary + '</p>';
                }
                results += '<div class="list-meta">';
                results += '<span class="list-date">Submitted ' + published.toDateString() + '</span>';
                if (updated > published) {
                    results += ' (updated ' + updated.toDateString() + ')';
                }
                results += '</div>';
                
                // 添加所有可能的元数据
                const metadataFields = [
                    { label: 'Comments', value: comments },
                    { label: 'Journal ref', value: journalRef },
                    { label: 'DOI', value: doi, isLink: true },
                    { label: 'Primary Category', value: primaryCategory },
                    { label: 'All Categories', value: categories.join(', ') },
                    { label: 'MSC Class', value: mscClass },
                    { label: 'ACM Class', value: acmClass },
                    { label: 'Report Number', value: reportNo },
                    { label: 'License', value: license },
                    { label: 'Version', value: version }
                ];

                metadataFields.forEach(field => {
                    if (field.value) {
                        results += '<div class="list-meta"><span>' + field.label + ': ';
                        if (field.isLink) {
                            results += '<a href="https://doi.org/' + field.value + '" target="_blank">' + field.value + '</a>';
                        } else {
                            results += field.value;
                        }
                        results += '</span></div>';
                    }
                });

                if (psLink) {
                    results += '<div class="list-meta"><span><a href="' + psLink + '" target="_blank">PostScript</a></span></div>';
                }
                
                results += '</dd>';
            });
        }

        results += '</dl>';

        // 添加分页控件
        results += '<div id="pagination">';
        results += '<button id="prev-page" ' + (currentStart === 0 ? 'disabled' : '') + '>上一页</button>';
        results += '<span>第 ' + (Math.floor(currentStart / resultsPerPage) + 1) + ' 页,共 ' + Math.ceil(totalResults / resultsPerPage) + ' 页</span>';
        results += '<button id="next-page" ' + (currentStart + resultsPerPage >= totalResults ? 'disabled' : '') + '>下一页</button>';
        results += '</div>';

        console.log('Results HTML:', results);
        $('#results-container').html(results);

        // 添加分页按钮事件监听器
        $('#prev-page').on('click', loadPreviousPage);
        $('#next-page').on('click', loadNextPage);

        console.log('Results displayed');
    }

    function getSelectedPapers() {
        return papers.filter(paper => 
            document.getElementById(paper.id).checked
        );
    }

    function addEditCitation() {
        console.log('Adding/Editing citation');
        const selectedPapers = getSelectedPapers();
        if (selectedPapers.length === 0) {
            alert('请先选择要引用的论文');
            return;
        }

        insertCitation(selectedPapers);
    }

    function addBibliography() {
        console.log('Adding bibliography');
        const selectedPapers = getSelectedPapers();
        if (selectedPapers.length === 0) {
            alert('请先选择要添加到参考文献表的论文');
            return;
        }
        insertBibliography(selectedPapers);
    }

    function refreshCitations() {
        console.log('Refreshing inserted citations and bibliography');
        updateAllCitations();
    }

    function insertCitation(selectedPapers) {
        // 获取用户选择的引用格式
        const citationFormat = $('#citation-format').val();
        
        // 为每个选中的论文生成引用
        const citations = selectedPapers.map(paper => {
            // 使用 Citation.js 创建引用对象
            const cite = new Cite(convertToCSL(paper));
            // 格式化引用,使用选定的格式和中文语言设置
            return cite.format('citation', { format: 'text', template: citationFormat, lang: 'en-US' });
        });

        // 创建一个包含论文ID和引用内容的字段对象
        const field = {
            // 值包含一个特殊标记和选中论文的ID
            Value: 'ADDIN_CITATION' + JSON.stringify(selectedPapers.map(p => p.id)),
            // 内容是格式化后的引用,多个引用用分号连接
            Content: citations.join('; ')
        };

        // 调用 ONLYOFFICE 插件方法插入引用字段
        window.Asc.plugin.executeMethod("AddAddinField", [field], function() {
            console.log('Citation inserted');
        });
    }

    function insertBibliography(selectedPapers) {
        // 获取用户选择的引用格式
        const citationFormat = $('#citation-format').val();
        
        // 将选中的论文转换为 CSL (Citation Style Language) 格式
        const selectedPapersCSL = selectedPapers.map(convertToCSL);
        
        // 使用 Citation.js 创建引用对象
        const cite = new Cite(selectedPapersCSL);
        
        // 生成参考文献列表，使用选定的格式和中文语言设置
        const bibliography = cite.format('bibliography', { format: 'text', template: citationFormat, lang: 'en-US' });

        // 创建一个包含参考文献列表的字段对象
        const field = {
            // 使用特殊标记 'ADDIN_BIB_ENTRY' 标识这是一个参考文献列表
            Value: 'ADDIN_BIB_ENTRY',
            // 内容是格式化后的参考文献列表
            Content: bibliography
        };

        // 调用 ONLYOFFICE 插件方法插入参考文献列表字段
        window.Asc.plugin.executeMethod("AddAddinField", [field], function() {
            console.log('Bibliography inserted');
        });
    }

    function updateAllCitations() {
        window.Asc.plugin.executeMethod("GetAllAddinFields", null, function(arrFields) {
            const updatedFields = [];
            const citationFormat = $('#citation-format').val();

            // 首先收集所有已插入引用的论文ID
            const allInsertedPaperIds = arrFields
                .filter(f => f.Value.indexOf('ADDIN_CITATION') !== -1)
                .flatMap(f => JSON.parse(f.Value.slice('ADDIN_CITATION'.length)));
            const uniqueInsertedPaperIds = [...new Set(allInsertedPaperIds)];

            // 只选择已插入的论文
            const insertedPapers = papers.filter(p => uniqueInsertedPaperIds.includes(p.id));

            arrFields.forEach(function(field) {
                if (field.Value.indexOf('ADDIN_CITATION') !== -1) {
                    const paperIds = JSON.parse(field.Value.slice('ADDIN_CITATION'.length));
                    const selectedPapers = insertedPapers.filter(p => paperIds.includes(p.id));
                    const citations = selectedPapers.map(paper => {
                        const cite = new Cite(convertToCSL(paper));
                        return cite.format('citation', { format: 'text', template: citationFormat, lang: 'en-US' });
                    });
                    field.Content = citations.join('; ');
                    updatedFields.push(field);
                } else if (field.Value === 'ADDIN_BIB_ENTRY') {
                    const cite = new Cite(insertedPapers.map(convertToCSL));
                    field.Content = cite.format('bibliography', { format: 'text', template: citationFormat, lang: 'en-US' });
                    updatedFields.push(field);
                }
            });

            if (updatedFields.length) {
                window.Asc.plugin.executeMethod("UpdateAddinFields", [updatedFields], function() {
                    console.log('All inserted citations and bibliography updated');
                });
            } else {
                console.log('No citations or bibliography found to update');
            }
        });
    }

    function convertToCSL(paper) {
        return {
            id: paper.id,
            title: paper.title,
            author: paper.authors.map(name => {
                const parts = name.split(' ');
                return { given: parts.slice(0, -1).join(' '), family: parts.slice(-1)[0] };
            }),
            type: 'article-journal',
            issued: { 'date-parts': [[new Date(paper.published).getFullYear()]] },
            URL: `https://arxiv.org/abs/${paper.id}`,
            publisher: 'arXiv'
        };
    }

    let isProcessingButton = false;

    window.Asc.plugin.button = function(id) {
        if (isProcessingButton) return;
        isProcessingButton = true;

        switch (id) {
            case 0:
            case 'addEditCitationBtn':
                addEditCitation();
                break;
            case 1:
            case 'addBibliographyBtn':
                addBibliography();
                break;
            case 2:
            case 'refreshBtn':
                refreshCitations();
                break;
        }

        setTimeout(() => {
            isProcessingButton = false;
        }, 100);
    };

    function loadPreviousPage() {
        if (currentStart >= resultsPerPage) {
            currentStart -= resultsPerPage;
            performSearch();
        }
    }

    function loadNextPage() {
        if (currentStart + resultsPerPage < totalResults) {
            currentStart += resultsPerPage;
            performSearch();
        }
    }

    // 添加一个新函数来处理搜索表单的提交
    function handleSearchSubmit(event) {
        event.preventDefault();
        currentStart = 0; // 重置到第一页
        performSearch();
    }
})(window, undefined);