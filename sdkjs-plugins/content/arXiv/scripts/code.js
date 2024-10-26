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
            $('#addEditBibliographyBtn').off('click');
            $('#refreshBtn').off('click');

            // 添加新的事件监听器
            $('#search-button').on('click', performSearch);
            $('#search-input').keypress(function(e) {
                if (e.which == 13) {
                    performSearch();
                }
            });
            $('#addEditCitationBtn').on('click', addCitation);
            $('#addEditBibliographyBtn').on('click', addBibliography);
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
        console.log('Initiating search...');

        // 如果是新搜索,重置起始位置
        if (event) currentStart = 0;

        var searchField = $('#search-field').val();
        var query = $('#search-input').val().trim();
        var sortBy = $('#sort-by').val();
        var sortOrder = $('#sort-order').val();
        var showAbstracts = $('#show-abstracts').is(':checked');

        if (!query) {
            $('#error-message').text('Please enter a search keyword').show();
            $('#loading-indicator').hide();
            return;
        }

        window.Asc.plugin.arXiv.api.performSearch(searchField, query, sortBy, sortOrder, showAbstracts, currentStart, resultsPerPage)
            .then(result => {
                papers = result.papers;
                totalResults = result.totalResults;
                $('#results-container').html(result.resultsHTML);

                // 添加分页控件
                addPaginationControls();
            });
    }

    function addPaginationControls() {
        var paginationHTML = '<div id="pagination">';
        paginationHTML += '<button id="prev-page" ' + (currentStart === 0 ? 'disabled' : '') + '>Previous Page</button>';
        paginationHTML += '<span>Page ' + (Math.floor(currentStart / resultsPerPage) + 1) + ' of ' + Math.ceil(totalResults / resultsPerPage) + '</span>';
        paginationHTML += '<button id="next-page" ' + (currentStart + resultsPerPage >= totalResults ? 'disabled' : '') + '>Next Page</button>';
        paginationHTML += '</div>';

        $('#results-container').append(paginationHTML);

        $('#prev-page').on('click', loadPreviousPage);
        $('#next-page').on('click', loadNextPage);
    }

    function getSelectedPapers() {
        return papers.filter(paper => 
            document.getElementById(paper.id).checked
        );
    }

    function addCitation() {
        console.log('Adding citation');
        const selectedPapers = getSelectedPapers();
        if (selectedPapers.length === 0) {
            alert('Please select papers to cite');
            return;
        }

        insertCitation(selectedPapers);
    }

    function addBibliography() {
        console.log('Adding bibliography');
        const selectedPapers = getSelectedPapers();
        if (selectedPapers.length === 0) {
            alert('Please select papers to add to the bibliography');
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
            author: paper.authors.map(author => {
                const nameParts = author.name.split(' ');
                return { 
                    given: nameParts.slice(0, -1).join(' '), 
                    family: nameParts.slice(-1)[0] 
                };
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
                addCitation();
                break;
            case 1:
            case 'addEditBibliographyBtn':
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

        window.Asc.plugin.executeCommand("close", "");
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
