(function(window, undefined) {
    'use strict';

    if (!window.Asc.plugin.arXiv) window.Asc.plugin.arXiv = {};
    window.Asc.plugin.arXiv.api = {
        performSearch: function(searchField, query, sortBy, sortOrder, showAbstracts, currentStart, resultsPerPage) {
            console.log('Performing search...');
            $('#loading-indicator').show();
            $('#results-container').empty();
            $('#error-message').hide();

            var apiUrl = 'https://export.arxiv.org/api/query?';
            var searchQuery = '';

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

            if (sortBy !== 'relevance') {
                apiUrl += '&sortBy=' + sortBy;
                apiUrl += '&sortOrder=' + sortOrder;
            }

            apiUrl += '&start=' + currentStart + '&max_results=' + resultsPerPage;

            console.log('API URL:', apiUrl);

            return fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.statusText);
                    }
                    return response.text();
                })
                .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
                .then(data => {
                    return this.displayResults(data, showAbstracts);
                })
                .catch(error => {
                    console.error('Search error:', error);
                    $('#error-message').text('Search error: ' + error.message).show();
                    $('#results-container').html('<p>Search failed. Please try again later.</p>');
                    return { papers: [], totalResults: 0 };
                })
                .finally(() => {
                    $('#loading-indicator').hide();
                });
        },

        displayResults: function(data, showAbstracts) {
            console.log('Displaying results...');
            var papers = [];
            var results = '<dl>';
            var entries = data.getElementsByTagName('entry');
            console.log('Number of entries found:', entries.length);

            var totalResults = parseInt(data.getElementsByTagName('opensearch:totalResults')[0].textContent);

            if (entries.length === 0) {
                results += '<dt>No matching results found.</dt>';
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

                    results += this.generatePaperHTML(id, title, authors, summary, link, published, updated, categories, comments, journalRef, doi, primaryCategory, showAbstracts);
                });
            }

            results += '</dl>';

            console.log('Results HTML generated');
            return { papers, totalResults, resultsHTML: results };
        },

        generatePaperHTML: function(id, title, authors, summary, link, published, updated, categories, comments, journalRef, doi, primaryCategory, showAbstracts) {
            var html = '<dt>';
            html += '<div class="paper-header">';
            html += '<input type="checkbox" id="' + id + '" name="paper">';
            html += '<label for="' + id + '">';
            html += '<span class="list-identifier">';
            html += '<a href="https://arxiv.org/abs/' + id + '" target="_blank">arXiv:' + id + '</a>';
            html += ' [<a href="' + link + '" target="_blank">pdf</a>, <a href="https://arxiv.org/format/' + id + '" target="_blank">other</a>]';
            html += '</span>';
            html += ' <span class="list-category">' + primaryCategory + '</span>';
            html += '</label>';
            html += '</div>';
            html += '<div class="paper-details">';
            html += '<div class="list-title">' + title + '</div>';
            html += '<div class="list-authors">' + authors.map(author => 
                '<a href="https://arxiv.org/search/?searchtype=author&query=' + 
                encodeURIComponent(author.name) + 
                '" target="_blank">' + 
                author.name + 
                '</a>' + 
                (author.affiliation ? ' (' + author.affiliation + ')' : '')
            ).join(', ') + '</div>';
            html += '</div>';
            html += '</dt>';
            html += '<dd>';
            if (showAbstracts) {
                html += '<p class="mathjax">' + summary + '</p>';
            }
            html += '<div class="list-meta">';
            html += '<span class="list-date">Submitted ' + published.toDateString() + '</span>';
            if (updated > published) {
                html += ' (updated ' + updated.toDateString() + ')';
            }
            html += '</div>';
            
            const metadataFields = [
                { label: 'Comments', value: comments },
                { label: 'Journal ref', value: journalRef },
                { label: 'DOI', value: doi, isLink: true },
                { label: 'Primary Category', value: primaryCategory },
                { label: 'All Categories', value: categories.join(', ') }
            ];

            metadataFields.forEach(field => {
                if (field.value) {
                    html += '<div class="list-meta"><span>' + field.label + ': ';
                    if (field.isLink) {
                        html += '<a href="https://doi.org/' + field.value + '" target="_blank">' + field.value + '</a>';
                    } else {
                        html += field.value;
                    }
                    html += '</span></div>';
                }
            });
            
            html += '</dd>';
            return html;
        }
    };

})(window, undefined);
