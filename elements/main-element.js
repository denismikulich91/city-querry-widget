var base = document.currentScript.src || document.currentScript.baseURI;
base = base.substring(0, base.lastIndexOf('/')) + "/..";

Polymer({
    is: 'main-element',

    properties: {
        displayedResults: Array,
        activeItem: {
            observer: '_activeItemChanged'
        },
        suggestResults: Array,
        suggestActiveItem: {
            observer: '_suggestActiveItemChanged'
        },
        pagination: {
            type: Object,
            value: {
                page: 0,
                pages: [],
                displayNextPageBtn: false,
                displayPrevPageBtn: false
            }
        },
        searchSummary: {
            type: Object,
            value: {
                start: 0,
                end: 0,
                total: 0
            }
        },
        toolMsg: String,
        attributeFilter: {
            type: Object,
            value: {
                attribute: "",
                operators: [],
                value: ""
            }
        },
        attributeFilterValues: Array,
        searchDataset: {
            type: Boolean,
            value: false
        },
        disableDeleteDataset: {
            type: Boolean,
            value: true
        },
        selectedFeatureIds: Array,
		deleteDatasetId: String,
		counter: {
            type: Number,
            value: 0
        }
    },
    ready: function() {
        require.config({
            paths: {
                'Ext': base + '/assets/models',
                'Libs': base + '/assets/libs',
                'controllers': base + '/assets/controllers',
                'helpers': base + '/assets/helpers',
                'ExtModels': base + '/../assets/models',
                'ExtLibs': base + '/../assets/libs',
                'ExtHelper': base + '/../assets/helpers',
                'DS/UrbanWidget': base + '/../assets/api'
            }
        });

        var that = this;
        require(
            [
                "DS/PlatformAPI/PlatformAPI",
                "controllers/Search",
                "controllers/AttributeFilter",
                "Ext/DatasetManager",
                "Ext/PlatformCompassServices",
                "Libs/cheet"
            ],
            function(
                PlatformAPI,
                Search,
                AttributeFilter,
                DatasetManager
                ,PlatformCompassServices
            ) {
                that.PlatformAPI = PlatformAPI;
                that.Search = Search;
                that.AttributeFilter = AttributeFilter;
                that.DatasetManager = DatasetManager;

                widget.addEvent("onLoad", that._onLoad.bind(that));
                widget.addEvent("onRefresh", that._onRefresh.bind(that));
            }
        );
    },
    _onLoad: function() {
        this._manageSubscriptions();
        this._init();
    },
    _onRefresh: function() {
        this._init();
    },
    _proceed: function() {
        $("#content")[0].hide();

        $("#whereInput")[0].allowAdd = false;
        this.clear();
        this.Search.queryManager.getRefrentialUUID().then(function() {
            $("#loading")[0].hide();
            $("#content")[0].show();
       });

        $("#exportBtn")[0].disabled = false;
        $("#exportSpinner")[0].hide();
        $("#exportDropdownIcon")[0].show();

        this.disableDeleteDataset = widget.getValue("enableDeleteDataset");
        // var that = this;
        // cheet('↑ ↑ ↓ ↓ ← → ← →', function() {
            // that.disableDeleteDataset = false;
        // });
    },
    _init: function() {
        $("#loading")[0].show();

        var that = this;
        var checkXCity = setInterval(function() {
            if(that.Search.queryManager.getXCity() && that.Search.queryManager.getXCity().widgetData.currentReferential.get("title")) {	                 that._proceed();
                clearInterval(checkXCity);
            }
        }, 1000);
    },
    _manageSubscriptions: function() {
        if (this.itemDeselectSubscription) {
            this.itemDeselectSubscription.unsubscribe();
        }
        if (this.itemSelectSubscrition) {
            this.itemSelectSubscrition.unsubscribe();
        }
        this.PlatformAPI.unsubscribe('3DEXPERIENCity.BufferQueryReturn');

        // // Subscribe / Re-subscribe
        this.itemSelectSubscription = this.PlatformAPI.subscribe('3DEXPERIENCity.OnItemSelect', this._onItemSelect.bind(this));
        this.itemDeselectSubription = this.PlatformAPI.subscribe('3DEXPERIENCity.OnItemDeselect', this._onItemDeselect.bind(this));
    },
    _onItemDeselect: function(featureId) {
        console.info('onItemDeselect', featureId);

        if (this.selectedFeatureIds.contains(featureId)){
            this.Search.deselectFeature(featureId);
        }
    },
    _onItemSelect: function(featureId) {
        console.info('onItemSelect', featureId);
        this._showSelectedFeatureDetails(featureId);
    },
    _showSelectedFeatureDetails: function(featureId) {
        var that = this;
        this.Search.featuresManager.getSelectedFeature().then(function(data) {
            var selectedFeatureId = data.userData.STRID || featureId;

            for (var i = 0, length = that.displayedResults.length; i < length; i++) {
                var strid;
                if (that.displayedResults[i].STRID) {
                    strid = that.displayedResults[i].STRID.value;
                }
                if (that.displayedResults[i].searchResultId == selectedFeatureId || strid == selectedFeatureId) {
                    var datagrid = $("#resultsDatagrid")[0];
                    datagrid.selectedItems = [that.displayedResults[i]];
                    datagrid.expandedItems = [that.displayedResults[i]];
                    datagrid.$.scroller.scrollToIndex(i);

                    that.selectedFeatureIds.push(featureId);
                    return;
                }
            }
        });
    },
    setWhatTag: function(e) {
        $("#whatInput")[0].tagTpl = {
            id: this.Search.searchProperties.getNextWhatFilterIndex() + "",
            label: e.currentTarget.value
        }

        this._toggleSearchBtn(false);

        var that = this;
        clearTimeout(this.setWhatTagTimer);
        this.setWhatTagTimer = setTimeout(function() {
            var input = $("#whatInput")[0];
            if (input.value.trim() == "") {
                input.value = "";
                return;
            }

            input._addTag();
            input.value = "";

            that._toggleSearchBtn(true);
        }, 1800);
    },
    _highlightSelectedPaperTag: function(paperTagInputId, tagId) {
        this._removeAllTagSelection(paperTagInputId);

        var selectedTagIndex;
        var tags = $("#" + paperTagInputId)[0].items;
        for (var i = 0, length = tags.length; i < length; i++) {
            if (tags[i].id == tagId) {
                selectedTagIndex = i;
                break;
            }
        }

        if (selectedTagIndex != undefined) {
            var tag = $("#" + paperTagInputId + " paper-tags div")[selectedTagIndex];
            tag.classList.add("main-element");
            tag.classList.add("selectedTag");
            $("paper-icon-button", tag)[0].classList.add("main-element");
            $("paper-icon-button", tag)[0].classList.add("selectedTag");
        }
    },
    processSelectedWhatTag: function(e) {
        this._highlightSelectedPaperTag("whatInput", e.detail.id);

        var whatFilter = this.Search.searchProperties.whatFilters[e.detail.id];
        whatFilter.index = e.detail.id;
        this.openAttributeFilterDialog(whatFilter, false);
    },
    processWhatTagAdded: function(e) {
        clearTimeout(this.setWhatTagTimer);

        if (this.skipAddWhatTag) {
            this.skipAddWhatTag = undefined;
            return;
        }

        var inputValue = e.detail.label.toUpperCase(); //input.value.trim().toUpperCase();
        if (this.AttributeFilter.isAttributeJoinOperator(inputValue)) {
            e.detail.label = inputValue;
            this.Search.searchProperties.addWhatFilter(undefined, inputValue);
        } else {
            console.log("What tag added", e.detail);
            this.Search.searchProperties.addWhatFilter(e.detail.label);
            this._toggleSearchBtn(true);
        }
    },
    processWhatTagRemoved: function(e) {
        console.log("What tag removed", e.detail);
        this.Search.searchProperties.removeWhatFilter(e.detail.id);
    },
    addAttributeJoinOperator: function(e) {
        var operator = e.target ? e.target.innerText : e;
        console.log("Add attribute join operator", operator);

        this.skipAddWhatTag = true;
        var index = this.Search.searchProperties.addWhatFilter(undefined, operator);
        $("#whatInput")[0].tagTpl = {
            id: index,
            label: operator
        };
        $("#whatInput")[0]._addTag();
    },
    showAttributeValueSuggestions: function(e) {
        // console.log("Show attribute filter suggestions", e);
        if ($("#attributeFilterValuesList")[0] == undefined) {
            return;
        }

        if (e.detail.value == true) {
            $("#attributeFilterValuesList")[0].show();
        } else {
            setTimeout(function() {
                $("#attributeFilterValuesList")[0].hide();
            }, 200);
        }
    },
    updateAttributeFilter: function() {
        var joinOperator = $("#attributeFilterJoin")[0].value;
        var field = $("#attributeFilterField")[0].value == "" ? undefined : $("#attributeFilterField")[0].value;
        var attribute = this.attributeFilter.attribute;
        var operator = $("#attributeFilterOperator")[0].value == "" ? undefined : $("#attributeFilterOperator")[0].value;
        var displayValue = $("#attributeFilterValue")[0].value;
        var value = this._formatValueWithPrecision($("#attributeFilterValue")[0].value, this.attributeFilter.precision);
        var index = this.attributeFilter.index;

        this.Search.searchProperties.updateWhatFilter(index, value, joinOperator, field, operator);

        var tags = $("#whatInput")[0].items.slice();
        for (var i = 0, length = tags.length; i < length; i++) {
            if (tags[i].id == index) {
                var newLabel = ((joinOperator || "") + " " + (attribute || "") + " " + (operator || "") + " " + (displayValue || "")).trim();
                tags[i].label = newLabel;
                $('#whatInput paper-tags div span')[i].innerText = newLabel;
                break;
            }
        }

        $('#addAttributeFilterDialog')[0].hide();
        this._removeAllTagSelection("whatInput");
    },
    addAttributeFilter: function() {
        var joinOperator = undefined; //$("#attributeFilterJoin")[0].value;
        var attribute = this.attributeFilter.attribute;
        var field = $("#attributeFilterField")[0].value;
        var operator = $("#attributeFilterOperator")[0].value;
        var displayValue = $("#attributeFilterValue")[0].value;
        var value = this._formatValueWithPrecision($("#attributeFilterValue")[0].value, this.attributeFilter.precision);

        var index = this.Search.searchProperties.addWhatFilter(value, joinOperator, field, operator);

        this.skipAddWhatTag = true;

        $("#whatInput")[0].tagTpl = {
            id: index.toString(),
            label: /*joinOperator + " " + */ attribute + " " + operator + " " + displayValue
        };
        $("#whatInput")[0]._addTag();

        $('#addAttributeFilterDialog')[0].hide();
    },
    cancelAddAttributeFilter: function() {
        $('#addAttributeFilterDialog')[0].hide();
    },
    processUpdateSearchRadius: function() {
        clearTimeout(this.updateSearchRadiusTimer);
        this.updateSearchRadiusTimer = setTimeout(this._updateSearchRadiusPolygon.bind(this), 800);
    },
    _updateSearchRadiusPolygon: function() {
        if (this.selectedTagIndex == undefined) {
            return;
        }

        var radius = parseInt($("#searchRadiusInput")[0].value);
        this.Search.updateSearchRadiusPolygon(radius, this.selectedTagIndex);
    },
    processSelectedWhereTag: function(e) {
        this._highlightSelectedPaperTag("whereInput", e.detail.id);
        this.selectedTagIndex = e.detail.id;

        $("#searchRadiusInput")[0].value = this.Search.searchProperties.geometricFilterGet("buffer", this.selectedTagIndex);
    },
    processWhereInputRemoved: function(e) {
        if (this.whereInputlastTriggerTime) {
            var duration = Date.now() - this.whereInputlastTriggerTime;
            if (duration < 300) {
                return;
            }
        }
        this.whereInputlastTriggerTime = Date.now();
        this.Search.searchProperties.removeGeometricFilter(e.detail.id);
        this.Search.featuresManager.removeSearchGeometry(e.detail.id);
    },
    addSelectedFeatureToWhere: function() {
        this.Search.addSelectedFeatureToWhere(this._processAddSelectedFeatureToWhere.bind(this));
    },
    _processAddSelectedFeatureToWhere: function(name, index) {
        $("#whereInput")[0].tagTpl = { "label": name };
        $("#whereInput")[0]._addTag(index + '');
        this.Search.zoomToViewAllWhereFeatures();
    },
    _toggleIconButton: function(btn) {
        var enable = btn.hasClass("enabled");

        if (enable) {
            btn.removeClass("enabled");
        } else {
            btn.addClass("enabled");
        }

        return !enable;
    },
    toggleSetPoint: function(e) {
        var btn = e.currentTarget;
        var enable = this._toggleIconButton(btn);

        if (enable) {
            this._toggleSearchClearBtn(false);

            var that = this;
            this.Search.enableSetPoint(function(label, index) {
                that._toggleIconButton(btn);
                that._toggleSearchClearBtn(true);
                that._processAddSelectedFeatureToWhere(label, index);
            });
        } else {
            this._toggleSearchClearBtn(true);
            this.Search.disableSetPoint();
        }
    },
    toggleDrawLine: function(e) {
        var btn = e.currentTarget;
        var enable = this._toggleIconButton(btn);
        if (enable) {
            this._toggleSearchClearBtn(false);
            this.toolMsg = "Click button again to end drawing line.";

            this.Search.enableDrawLine();
        } else {
            this._toggleSearchClearBtn(true);
            this.toolMsg = "";

            this.Search.disableDrawLine(this._processAddSelectedFeatureToWhere.bind(this));
        }
    },
    toggleDrawPolygon: function(e) {
        var btn = e.currentTarget;
        var enable = this._toggleIconButton(btn);
        if (enable) {
            this._toggleSearchClearBtn(false);
            this.toolMsg = "Click button again to end drawing polygon.";

            this.Search.enableDrawPolygon();
        } else {
            this._toggleSearchClearBtn(true);
            this.toolMsg = "";

            this.Search.disableDrawPolygon(this._processAddSelectedFeatureToWhere.bind(this));
        }
    },
    _toggleSearchClearBtn: function(enabled) {
        if (enabled == true) {
            $("#searchBtn")[0].removeAttribute("disabled");
            $("#clearBtn")[0].removeAttribute("disabled");
        } else {
            $("#searchBtn")[0].setAttribute("disabled", "");
            $("#clearBtn")[0].setAttribute("disabled", "");
        }
    },
    _toggleSearchBtn: function(enabled) {
        if (enabled == true) {
            $("#searchBtn")[0].removeAttribute("disabled");
        } else {
            $("#searchBtn")[0].setAttribute("disabled", "");
        }
    },
    toArray: function(selectedObj) {
        if (selectedObj == undefined) {
            return;
        }		
		
		let obj = selectedObj.properties ? selectedObj.properties : selectedObj;
        var keys = Object.keys(obj);
        var filteredKeys = keys.filter(function(key) {
            var omitKeys = ["physicalid", "url", "distance", "searchResultId", "geometry", "geometrytype", "layerindex", "layername", "size",
                "dataset_uuid", "dataset_docId", "dataset_startLevel", "dataset_endLevel", "dataset_pixTileBorder", "dataset_referential", "dataset_exposedAttributeList"
            ];
            return omitKeys.indexOf(key) == -1;
        });
	
        return filteredKeys.map(function(key) {
            return {
                name: key.replace("dataset_", ""),
                key: key,
                value: obj[key].value ? obj[key].value : obj[key],
                disableAttributeFilter: obj[key].disableAttributeFilter
            };
        });
    },
    getGeoTypeIcon: function(type, enoviaDocId) {
        return this.Search.getGeoTypeIcon(type, enoviaDocId);
    },
    getFeatureName: function(item) {
		let featureName = this.Search.getFeatureName(item);
		console.log("Displaying",featureName);
        return featureName;
    },
    setWhereWithSuggest: function() {
        var selectedSuggestion = $("#suggestDatagrid")[0].expandedItems[0];
        var radius = parseInt($("#searchRadiusInput")[0].value);

        var that = this;
        this.Search.setWhereWithSuggest(selectedSuggestion, radius, function(label, index) {
            that._processAddSelectedFeatureToWhere(label, index);
            that.unsetWhereWithSuggest();
        });
    },
    unsetWhereWithSuggest: function() {
        $("#whereInput")[0].value = "";
        $("#suggestions")[0].hide();
    },
    newSearch: function() {
        this.Search.searchProperties.page = 0;
        this._search();
    },
    _search: function() {
        this._showSearchUpdating();

        var callbacks = {
            updatingCallback: this._showSearchUpdating.bind(this),
            completedCallback: this._processSearchResults.bind(this)
        }
        this.Search.search(this.searchDataset, callbacks);
    },
    _showSearchUpdating: function() {
        this.displayedResults = [];
        $("#searchingSpinner")[0].show();
        $("#searchSummary")[0].style.visibility = 'hidden';
    },
    _processSearchResults: function(start, nhits, results) {
        this._updateSearchSummary(start, nhits, results.length ? results.length > 0 ? results.length-1 : 0 : 0);
        this._updatePagination(start, nhits);
		console.log(results)
		for(let i=0;i< results.length;i++) {
			results[i].index = i + start + 1;
		}
        this.displayedResults = results;
        $("#resultsDatagrid")[0].$.scroller.scrollToIndex(100);
        $("#resultsDatagrid")[0].$.scroller.scrollToIndex(0);

        $("#searchingSpinner")[0].hide();
        $("#searchSummary")[0].style.visibility = 'visible';
    },
    _updateSearchSummary: function(start, total, length) {
        if (total > 0) {
            start += 1;
        }
        this.searchSummary = {
            start: Math.min(start, total),
            end: Math.min(start + length, total),
            total: total
        };
    },
    _updatePagination: function(start, total) {
        $("#resultsDatagrid")[0].pageSize = 100;

        if (total <= 100) {
            this.pagination = {
                pages: [1],
                page: 1,
                displayNextPageBtn: false,
                displayPrevPageBtn: false
            }
        } else {
            var pagination = {
                page: start / 100
            }

            var pageList = [],
                paginationStart, paginationEnd;

            if (pagination.page <= 5) {
                paginationStart = 1;
                paginationEnd = Math.min(Math.ceil(total / 100), 10);
            } else {
                paginationStart = pagination.page - 5;
                paginationEnd = Math.min(Math.ceil(total / 100), pagination.page + 5);
            }

            for (var i = paginationStart; i <= paginationEnd; i++) {
                pageList.push(i);
            }
            pagination.pages = pageList;
            pagination.displayPrevPageBtn = pagination.page > 0;
            pagination.displayNextPageBtn = pagination.page < Math.floor(total / 100);

            this.pagination = pagination;
        }

        document.activeElement.blur();
    },
    clear: function() {
        this.Search.clear();

        this.displayedResults = [];
        this.searchSummary = {
            start: 0,
            end: 0,
            total: 0
        };
        this.pagination = {
            page: 0,
            pages: [],
            displayNextPageBtn: false,
            displayPrevPageBtn: false
        };
        this.selectedTagIndex = undefined;
        this.selectedFeatureIds = [];

        $("#whereInput")[0].value = "";
        $("#whereInput")[0].items = [];
        $('#whatInput')[0].items = [];

        $("#searchingSpinner")[0].hide();
        setTimeout(function() {
            $("#searchSummary")[0].style.visibility = 'hidden';
        },100);
    },
    showExportOptions: function(e) {
        // console.log("Show attribute filter suggestions", e);
        if ($("#exportOptionsList")[0] == undefined) {
            return;
        }

        if (e.detail.value == true || e.detail == true) {
            $("#exportOptionsList")[0].show();
        } else {
            setTimeout(function() {
                $("#exportOptionsList")[0].hide();
            }, 200);
        }
    },
    export: function(e) {
        var exportType = e.currentTarget.selectedItem.getAttribute("value");
        e.currentTarget.select(undefined);

        if (this.displayedResults == undefined) {
            return;
        }
        if (this.displayedResults.length == 0) {
            return;
        }

        $("#exportBtn")[0].disabled = true;
        $("#exportSpinner")[0].show();
        $("#exportDropdownIcon")[0].hide();

        this.Search.export(exportType, function() {
            $("#exportBtn")[0].disabled = false;
            $("#exportSpinner")[0].hide();
            $("#exportDropdownIcon")[0].show();
        });
    },
    _getResultIndex: function(index) {
		console.log("index");
		console.log(this.searchSummary.start + "," + index);
        return this.searchSummary.start + index;
    },
    addDatasetLayer: function(e) {
        // this.DatasetManager.loadDataset(e.currentTarget.dataValue);

        var selectedLayerUUID = e.currentTarget.dataValue;

        for (var i = 0, length = this.displayedResults.length; i < length; i++) {
            if (this.displayedResults[i].dataset_uuid.value == selectedLayerUUID) {
                this.DatasetManager.loadDataset(this.displayedResults[i]);
                return;
            }
        }
    },
    deleteDataset: function(e) {
        if(this.disableDeleteDataset) {
			document.querySelector("#actions").open();
		}
		this.deleteDatasetId = e.currentTarget.dataValue;
		
		
    },
	handleDeleteDataset: function(event) {
		console.log(event);
	
		let action = document.querySelector("#actions").closingReason.confirmed ? "temp" : "permanent";	
		if(action === "permanent") {
			this.DatasetManager.removeDataset(this.deleteDatasetId).then(this._search.bind(this));
		}		
			//this.DatasetManager.removeDatasetFromRef(this.deleteDatasetId).then(this._search.bind(this));
		
		//if(document.querySelector("#actions"))
	},
    next: function() {
        this.Search.searchProperties.page = this.pagination.page + 1;
        this._search();
    },
    prev: function() {
        this.Search.searchProperties.page = this.pagination.page - 1;
        this._search();
    },
    select: function(e) {
        this.Search.searchProperties.page = parseInt(e.target.textContent) - 1;
        this._search();
    },
    isSelected: function(page, item) {
        return page === item - 1;
    },
    _formatValueWithPrecision(value, precision) {
        if (value == undefined) {
            return;
        }

        value = value.toString();
        if (!isNaN(value) && value.contains(".")) {
            var valueSplit = value.split(".");
            var valuePrecision = valueSplit[1] ? valueSplit[1].length : 0;
            for (var i = 0, length = precision - valuePrecision; i < length; i++) {
                value += "0";
            }
        }

        return value;
    },
    _removeAllTagSelection: function(paperTagInputId) {
        var tags = $("#" + paperTagInputId + " paper-tags div");
        for (var i = 0, length = tags.length; i < length; i++) {
            tags[i].classList.remove("selectedTag");
            tags[i].classList.remove("main-element");
            $("paper-icon-button", tags[i])[0].classList.remove("main-element");
            $("paper-icon-button", tags[i])[0].classList.remove("selectedTag");
        }
    },
    setAttributeFilterValue: function(e) {
        // console.log("Set attribute filter value", e);
        if (this.skipSetAttributeFilterValue == true) {
            return;
        }

        $("#attributeFilterValue")[0].value = e.currentTarget.selected;
        e.currentTarget.hide();
    },
    openAttributeFilterDialog: function(e, isAdd) {
        this.attributeFilterValues = [];

        if (isAdd) {
            this.attributeFilter = this.AttributeFilter.getNewAttributeFilter(e);
            this.attributeFilterValues = this.AttributeFilter._populateAttributeFilterAutocompleteValues(e.currentTarget.dataKey, this.displayedResults);

            this.skipSetAttributeFilterValue = true;
            var that = this;
            setTimeout(function() {
                that.skipSetAttributeFilterValue = undefined;
            }, 800);

            $("#attributeFilterJoin")[0].hide();
            $("#attributeFilterOperator")[0].show();
            $("#attributeFilterValue")[0].show();

            $("#updateAttributeFilterBtn")[0].hide();
            $("#addAttributeFilterBtn")[0].show();


        } else {
            this.attributeFilter = this.AttributeFilter.getModifyAttributeFilter(e);
            this.prevAttributeFilter = this.attributeFilter;

            this.attributeFilterValues = this.AttributeFilter._populateAttributeFilterAutocompleteValues(e.field, this.displayedResults);

            this.skipSetAttributeFilterValue = true;
            var that = this;
            setTimeout(function() {
                that.skipSetAttributeFilterValue = undefined;
            }, 800);

            e.joinOperator ? $("#attributeFilterJoin")[0].show() : $("#attributeFilterJoin")[0].hide();
            e.operator ? $("#attributeFilterOperator")[0].show() : $("#attributeFilterOperator")[0].hide();
            e.value ? $("#attributeFilterValue")[0].show() : $("#attributeFilterValue")[0].hide();

            $("#updateAttributeFilterBtn")[0].show();
            $("#addAttributeFilterBtn")[0].hide();
        }

        $('#addAttributeFilterDialog')[0].show();
    },
    _activeItemChanged: function(item) {
        var resultsDatagrid = $("#resultsDatagrid")[0];

        if (this.searchDataset) {
            console.log("dataset active item", item);
            resultsDatagrid.selectedItems = item ? [item] : [];
            resultsDatagrid.expandedItems = item ? [item] : [];
            return;
        }

        if (item == undefined) {
            if (resultsDatagrid != undefined) {
                resultsDatagrid.expandedItems = [];
            }
            return;
        }

        resultsDatagrid.selectedItems = item ? [item] : [];
        resultsDatagrid.expandedItems = item ? [item] : [];

        this.Search.zoomToFeature(item);
        this.Search.highlightFeatureOnMap(item);
    },
    _suggestActiveItemChanged: function(item) {
        if (item == undefined) {
            return;
        }

        $("#suggestDatagrid")[0].selectedItems = item ? [item] : [];
        $("#suggestDatagrid")[0].expandedItems = item ? [item] : [];
    },
    whereInputChanged: function() {
        this.suggestResults = [];

        clearTimeout(this.typingTimer);
        
        var that = this;
        this.typingTimer = setTimeout(
            function() {
                that.Search.getSuggestions().then(function(results) {
                    that.suggestResults = results;
                    $("#suggestionsSpinner")[0].hide();
                });
            },
            1000
        );

        $("#suggestionsSpinner")[0].show();
    },
    _searchDatasetChanged: function(searchDataset) {
        var resultsDatagrid = $("#resultsDatagrid")[0];
        if (resultsDatagrid) {
            resultsDatagrid.style.height = searchDataset ? "calc(100% - 230px)" : "calc(100% - 350px)";
        }
    },
    toggleSearchType: function(e) {
        var resultsDatagrid = $("#resultsDatagrid")[0];

        var btn = e.currentTarget;
        this.searchDataset = this._toggleIconButton(btn);
        if (this.searchDataset) {
            $("#advanceSearchToggle")[0].disabled = true;
            if (resultsDatagrid) {
                resultsDatagrid.style.height = "calc(100% - 280px)";
            }
        } else {
            $("#advanceSearchToggle")[0].disabled = false;
            if (resultsDatagrid) {
                resultsDatagrid.style.height = "calc(100% - 380px)";
            }
        }
    },
    toggleAdvanceSearch: function(e) {
        var btn = e.currentTarget;
        var enable = this._toggleIconButton(btn);
        if (enable) {
            $("#advanceSearchOperators")[0].show();
        } else {
            $("#advanceSearchOperators")[0].hide();
        }
    }
});