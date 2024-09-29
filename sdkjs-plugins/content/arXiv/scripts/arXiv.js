console.log('arXiv.js loaded');
console.log('window.Asc exists:', !!window.Asc);

(function(window, undefined) {
    'use strict';

    let papers = [];
    let Cite;

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

            $('.search-form').on('submit', performSearch);
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

        // 输出结果数量为50 
        apiUrl += '&start=0&max_results=50';

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
            })
            .finally(() => {
                $('#loading-indicator').hide();
            });
    }

    function displayResults(data, showAbstracts) {
        console.log('Displaying results...');
        papers = [];
        var results = '<dl>';
        var entries = data.getElementsByTagName('entry');
        console.log('Number of entries found:', entries.length);

        Array.from(entries).forEach((entry, index) => {
            var title = entry.getElementsByTagName('title')[0].textContent;
            var authors = Array.from(entry.getElementsByTagName('author')).map(author => 
                author.getElementsByTagName('name')[0].textContent
            );
            var summary = entry.getElementsByTagName('summary')[0].textContent;
            var link = Array.from(entry.getElementsByTagName('link')).find(link => 
                link.getAttribute('title') === 'pdf'
            )?.getAttribute('href');
            var id = entry.getElementsByTagName('id')[0].textContent.split('/').pop();
            var published = new Date(entry.getElementsByTagName('published')[0].textContent);
            var updated = new Date(entry.getElementsByTagName('updated')[0].textContent);
            var categories = Array.from(entry.getElementsByTagName('category')).map(cat => cat.getAttribute('term'));

            console.log('Processing entry:', index, 'Title:', title);

            papers.push({ title, authors, id, summary, link, published, updated, categories });

            results += '<dt>';
            results += '<input type="checkbox" id="' + id + '" name="paper">';
            results += '<label for="' + id + '">';
            results += '<div class="list-title">' + title + '</div>';
            results += '<div class="list-authors">' + authors.join(', ') + '</div>';
            results += '<div class="list-meta">';
            results += '<span class="list-identifier"><a href="https://arxiv.org/abs/' + id + '" target="_blank">arXiv:' + id + '</a></span>';
            results += '<span class="list-date">[Submitted on ' + published.toDateString() + ']</span>';
            if (updated > published) {
                results += '<span class="list-date">(updated ' + updated.toDateString() + ')</span>';
            }
            results += '</div>';
            if (categories.length > 0) {
                results += '<div class="list-subjects"><span class="primary-subject">' + categories[0] + '</span>';
                if (categories.length > 1) {
                    results += '<span class="other-subjects">; ' + categories.slice(1).join('; ') + '</span>';
                }
                results += '</div>';
            }
            results += '</label>';
            results += '</dt>';
            results += '<dd>';
            if (showAbstracts) {
                results += '<p class="mathjax">' + summary + '</p>';
            }
            results += '<p class="list-download">';
            if (link) {
                results += '<span class="list-pdf-link"><a href="' + link + '" target="_blank">PDF</a></span>';
            }
            results += '<span class="list-other-formats"><a href="https://arxiv.org/abs/' + id + '" target="_blank">Other formats</a></span>';
            results += '</p>';
            results += '</dd>';
        });

        results += '</dl>';

        console.log('Results HTML:', results);
        $('#results-container').html(results);
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
})(window, undefined);