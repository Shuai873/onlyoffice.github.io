(function(window, undefined){

    // 禁用右键菜单
    window.oncontextmenu = function(e)
	{
		if (e.preventDefault)
			e.preventDefault();
		if (e.stopPropagation)
			e.stopPropagation();
		return false;
    };
    
    // 转义HTML特殊字符
    function escapeHtml(string) {
        var res = string;
        res = res.replace(/[\', \", \\,]/g, function (sSymbol) {
            return '\\' + sSymbol;
        });
        return res;
    }

    // 存储解析后的OCR数据
    var arrParsedData = [];

    // 在文件顶部添加一个全局变量来存储完整的识别结果
    var fullRecognitionResults = [];

    // 定义状态切换函数
    function switchClass(el, className, add) {
        if (add) {
            el.classList.add(className);
        } else {
            el.classList.remove(className);
        }
    }

    function configState(hide) {
        switchClass(document.getElementById('configState'), 'display-none', hide);
    }

    function mainState(hide) {
        switchClass(document.getElementById('mainContent'), 'display-none', hide);
    }

    function switchAuthState(state) {
        configState(true);
        mainState(true);
        switch (state) {
            case 'config':
                configState(false);
                break;
            case 'main':
                mainState(false);
                break;
        }
    }

    // 插件初始化函数
    window.Asc.plugin.init = function(){

        // 将Mathpix选项卡及其项目添加至工具栏，
        this.executeMethod("AddToolbarMenuItem", [getToolbarItems()]);

        // 添加工具栏按钮的点击事件处理
        this.attachToolbarMenuClickEvent("openMainInterface", function() {
            switchAuthState('main');
        });

        this.attachToolbarMenuClickEvent("openConfigInterface", function() {
            switchAuthState('config');
            
            // 填充现有的配置
            $('#appIdField').val(localStorage.getItem('mathpix_app_id') || '');
            $('#appKeyField').val(localStorage.getItem('mathpix_app_key') || '');
        });

        // 添加保存配置按钮事件
        $('#saveConfigBtn').click(function() {
            const appId = $('#appIdField').val().trim();
            const appKey = $('#appKeyField').val().trim();

            if (appId && appKey) {
                localStorage.setItem('mathpix_app_id', appId);
                localStorage.setItem('mathpix_app_key', appKey);
                switchAuthState('main');
                alert('API配置已保存');
            } else {
                alert('请输入有效的App ID和App Key');
            }
        });

        // 初始化时检查是否已有配置
        const savedAppId = localStorage.getItem('mathpix_app_id');
        const savedAppKey = localStorage.getItem('mathpix_app_key');

        if (!savedAppId || !savedAppKey) {
            switchAuthState('config');
        } else {
            switchAuthState('main');
        }

        // 设置初始窗口大小
        this.resizeWindow(592, 100, 592, 100, 592, 100);
        var nStartFilesCount = 0, arrImages;
        
        // 窗口大小改变时更新滚动条
        $( window ).resize(function(){
            updateScroll();
        });

        // 更新滚动条
        function updateScroll(){
            Ps.update();
        }
        
        // 设置容器的固定高度
        $('#scrollable-image-text-div').css('height', '500px');
        
        // 初始化自定义滚动条
        var container = document.getElementById('scrollable-image-text-div');        
		Ps = new PerfectScrollbar("#" + container.id, {});
        
        // 加载文件按钮点击事件
        $('#load-file-button-id').click(
          					
			function (e) {
				
				// 桌面编辑器特殊处理
				if (window["AscDesktopEditor"])
				{
					// 打开文件选择对话框
					window["AscDesktopEditor"]["OpenFilenameDialog"]("images", true, function(files) {
                        arrImages = [];
                        
                        // 确保files是数组
                        if (!Array.isArray(files)) 
                            files = [files];

						if (files.length == 0)
							return;
						
						// 调整窗口大小
						window.Asc.plugin.resizeWindow(800, 571, 800, 571);
						
						// 清空图片容器
						var oImagesContainer = document.getElementById('image-container-div');
						while (oImagesContainer.firstChild) {
							oImagesContainer.removeChild(oImagesContainer.firstChild);
						}
						// 清空文本容器
						var oTextContainer = document.getElementById('text-container-div');
						while (oTextContainer.firstChild) {
							oTextContainer.removeChild(oTextContainer.firstChild);
						}
						arrParsedData.length = 0;
						fullRecognitionResults.length = 0; // 清空保存的识别结果
						
						// 加载选中的图片
						for (var i = 0; i < files.length; i++) 
						{
							var oImgElement = document.createElement('img');
							oImgElement.src = window["AscDesktopEditor"]["GetImageBase64"](files[i], false);
							oImgElement.style.width = '100%';
							oImgElement.style.marginBottom = "10px";
							arrImages.push(oImgElement);
							oImagesContainer.appendChild(oImgElement);
						}
						
						// 启用识别按钮
						document.getElementById('recognize-button').removeAttribute('disabled');
						nStartFilesCount = files.length;
						$('#status-label').text('');
						$('#scrollable-image-text-div').css('display', 'inline-block');
						updateScroll();
					});
					
					return;							
				}
			
                // 非桌面版则触发文件选择
                $('#images-input').click();
            }
        );				

        // 文件输入改变事件
        $('#images-input').change(function(e) {
            var arrFiles = e.target.files;
			// 检查文件列表中的图片
			var arrFiles2 = [];
			for(var i = 0; i < arrFiles.length; ++i){
				if(arrFiles[i] && arrFiles[i].type && arrFiles[i].type.indexOf('image') === 0){
					arrFiles2.push(arrFiles[i]);
				}
				else{
					alert(arrFiles[i].name + "\nOCR plugin cannot read this file.");
				}
			}
			arrFiles = arrFiles2;
            if(arrFiles.length > 0){
                // 调整窗口大小
                window.Asc.plugin.resizeWindow(800, 571, 800, 571);

                // 清空图片和文本容器
                var oImagesContainer = document.getElementById('image-container-div');
                while (oImagesContainer.firstChild) {
                    oImagesContainer.removeChild(oImagesContainer.firstChild);
                }
                var oTextContainer = document.getElementById('text-container-div');
                while (oTextContainer.firstChild) {
                    oTextContainer.removeChild(oTextContainer.firstChild);
                }
                arrParsedData.length = 0;
                fullRecognitionResults.length = 0; // 清空保存的识别结果
                
                // 使用FileReader加载图片
                var oFileReader = new FileReader();
                var nIndex = 0;
                arrImages = [];                
                $('#status-label').text('Loading images');
                oFileReader.onloadend = function() {
                    var oImgElement = document.createElement('img');
                    oImgElement.src = oFileReader.result;
                    oImgElement.style.width = '100%';
                    arrImages.push(oImgElement);
                    oImagesContainer.appendChild(oImgElement);
                    ++nIndex;
                    if(nIndex < arrFiles.length){
                        oFileReader.readAsDataURL(arrFiles[nIndex]);
                        $(oImgElement).css("margin-bottom", "10px");
                    }
                    else{
                        // 所有图片加载完成后，启用相控件
                        document.getElementById('recognize-button').removeAttribute('disabled');
                        nStartFilesCount = arrImages.length;
                        $('#status-label').text('');
                        $('#scrollable-image-text-div').css('display', 'inline-block');

                    }
                    updateScroll();
                };
                oFileReader.readAsDataURL(arrFiles[nIndex]);
            }
        });
        
        // 识别按钮点击事件
        $('#recognize-button').click(function () {
            // 复制图片数组并过滤无效图片
            var arrImagesCopy = [].concat(arrImages);
            for (var i = 0; i < arrImagesCopy.length; i++) {
                if (arrImagesCopy[i] && (0 == arrImagesCopy[i].naturalWidth) && (0 == arrImagesCopy[i].naturalHeight)) {
                    arrImagesCopy.splice(i, 1);
                    i--;
                }
            }
            if (0 == arrImagesCopy.length)
                return;

            // 清空文本容器
            var oTextContainer = document.getElementById('text-container-div');
            while (oTextContainer.firstChild) {
                oTextContainer.removeChild(oTextContainer.firstChild);
                updateScroll();
            }
            arrParsedData.length = 0;

            // 禁用相关控件
            document.getElementById('recognize-button').setAttribute('disabled', '');
            document.getElementById('load-file-button-id').setAttribute('disabled', '');

            // Mathpix OCR识别函数
            var mathpixOCR = function(image) {
                return new Promise((resolve, reject) => {
                    // 将图像转换为Blob对象
                    fetch(image.src)
                        .then(res => res.blob())
                        .then(blob => {
                            let formData = new FormData();
                            formData.append('file', blob, 'image.png');  // 添加文件到FormData
                            formData.append('options_json', JSON.stringify({
                                math_inline_delimiters: ["$", "$"],
                                rm_spaces: true,
                                formats: ["text", "data", "html", "latex"],
                                data_options: {
                                    include_asciimath: true,
                                    include_latex: true,
                                    include_svg: true,
                                    include_table_html: true,
                                    include_tsv: true,
                                    include_mathml: true
                                },
                                include_detected_alphabets: true,
                                include_line_data: true,
                                include_smiles: true, 
                                auto_rotate_confidence_threshold: 0.99
                            }));

                            fetch('https://api.mathpix.com/v3/text', {
                                method: 'POST',
                                headers: {
                                    'app_id': localStorage.getItem('mathpix_app_id'),
                                    'app_key': localStorage.getItem('mathpix_app_key')
                                },
                                body: formData
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.error) {
                                    reject(new Error(data.error));
                                } else {
                                    resolve(data);
                                }
                            })
                            .catch(error => {
                                reject(error);
                            });
                        })
                        .catch(error => {
                            reject(new Error('Error processing image: ' + error.message));
                        });
                });
            };

            var processImages = function(index) {
                if (index >= arrImagesCopy.length) {
                    $('#status-label').text('');
                    document.getElementById('recognize-button').removeAttribute('disabled');
                    document.getElementById('load-file-button-id').removeAttribute('disabled');
                    updateOutput();
                    return;
                }

                $('#status-label').text('Recognizing: ' + Math.round((index + 1) / arrImagesCopy.length * 100) + '%');

                mathpixOCR(arrImagesCopy[index])
                    .then(result => {
                        fullRecognitionResults.push(result);
                        updateScroll();
                        processImages(index + 1);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        let errorHtml = "<div><p>Error: " + error.message + "</p></div>";
                        fullRecognitionResults.push({error: error.message});
                        updateScroll();
                        processImages(index + 1);
                    });
            };

            processImages(0);
        });

        // 根据识别数据生成HTML
        function generateHTMLByData(oData) {
            let sResult = "<div>";
            const outputFormat = $('#output-format-select').val();

            switch(outputFormat) {
                case 'text':
                    if (oData.text) {
                        sResult += "<p>" + oData.text + "</p>";
                    } else {
                        sResult += "<p>No text content found.</p>";
                    }
                    break;
                case 'latex':
                    if (oData.latex_styled) {
                        sResult += "<p>" + oData.latex_styled + "</p>";
                    } else {
                        sResult += "<p>No LaTeX content found.</p>";
                    }
                    break;
                case 'html':
                    if (oData.html) {
                        sResult += oData.html;
                    } else {
                        sResult += "<p>No HTML content found.</p>";
                    }
                    break;
                case 'asciimath':
                    if (oData.data && oData.data.asciimath) {
                        sResult += "<p>" + oData.data.asciimath + "</p>";
                    } else {
                        sResult += "<p>No AsciiMath content found.</p>";
                    }
                    break;
                case 'mathml':
                    if (oData.data && oData.data.mathml) {
                        sResult += "<p>MathML:</p><pre>" + escapeHtml(oData.data.mathml) + "</pre>";
                    } else {
                        sResult += "<p>No MathML content found.</p>";
                    }
                    break;
                case 'chemical':
                    if (oData.data && oData.data.smiles) {
                        sResult += "<p>Chemical Structure (SMILES): " + oData.data.smiles + "</p>";
                    } else {
                        sResult += "<p>No chemical structure detected.</p>";
                    }
                    break;
                case 'table':
                    if (oData.data && oData.data.table_html) {
                        sResult += oData.data.table_html;
                    } else {
                        sResult += "<p>No table detected.</p>";
                    }
                    break;
                default:
                    sResult += "<p>Unsupported output format.</p>";
            }

            sResult += "</div>";
            return sResult;
        }


        function updateOutput() {
            var oTextContainer = document.getElementById('text-container-div');
            while (oTextContainer.firstChild) {
                oTextContainer.removeChild(oTextContainer.firstChild);
            }
            
            for (let result of fullRecognitionResults) {
                let htmlContent = generateHTMLByData(result);
                oTextContainer.appendChild($(htmlContent)[0]);
            }
            updateScroll();
        }

  
        $('#output-format-select').change(function() {
            updateOutput();
        });
    };

    function getToolbarItems() {
        let items = {
            guid: window.Asc.plugin.info.guid,
            tabs: [{
                id: "tab_mathpix",
                text: "Mathpix",
                items: [
                    {
                        id: "openMainInterface",
                        type: "button",
                        text: "OCR Image",
                        hint: "Perform OCR on images",
                        icons: "resources/buttons/images.png",
                        lockInViewMode: true,
                        enableToggle: false,
                        separator: false
                    },
                    {
                        id: "openConfigInterface",
                        type: "button",
                        text: "API Settings",
                        hint: "Configure API settings",
                        icons: "resources/buttons/settings.png",
                        lockInViewMode: true,
                        enableToggle: false,
                        separator: false
                    }
                ]
            }]
        };
  
        return items;
    }
    
    // 主题改变事件处理
    window.Asc.plugin.onThemeChanged = function(theme)
    {
        // 应用基础主题变更
        window.Asc.plugin.onThemeChangedBase(theme);

        
    };

    // 按钮点击事件处理
    window.Asc.plugin.button = function(id){
        if (id == 0){
            const outputFormat = $('#output-format-select').val();
            if (outputFormat === 'latex' && arrParsedData.length > 0) {
                // 如果选择了LaTeX格式且有识别数据，则插入LaTeX公式
                this.callCommand(function() {
                    for (let i = 0; i < arrParsedData.length; i++) {
                        if (arrParsedData[i].latex_styled) {
                            Api.GetDocument().AddMathEquation(arrParsedData[i].latex_styled, "latex");
                        }
                    }
                }, true);
            } else {
                // 对于其他格式，保持原有的粘贴HTML方法
                this.executeMethod("PasteHtml", [document.getElementById('text-container-div').innerHTML]);
            }
            this.executeCommand("close", "");
        }
        else{
            // 关闭插件
            this.executeCommand("close", "");
        }
    };

    // 翻译处理
	window.Asc.plugin.onTranslate = function(){
		// 翻译各个UI元素
		var elem = document.getElementById("label1");
		if (elem){
			elem.innerHTML = window.Asc.plugin.tr("Mathpix OCR specializes in recognizing mathematical formulas, along with text, tables, and chemical structures in images (png, jpg)");
		}
		elem = document.getElementById("load-file-button-id");
		if (elem){
			elem.innerHTML = window.Asc.plugin.tr("Load File");
		}	
		elem = document.getElementById("recognize-button");
		if (elem){
			elem.innerHTML = window.Asc.plugin.tr("Recognize");
		}
        elem = document.getElementById("label2");
        if (elem){
            elem.innerHTML = window.Asc.plugin.tr("Output Format");
        }
        
        var select = document.getElementById("output-format-select");
        if (select) {
            for (var i = 0; i < select.options.length; i++) {
                select.options[i].text = window.Asc.plugin.tr(select.options[i].text);
            }
        }
	};
	
})(window, undefined);