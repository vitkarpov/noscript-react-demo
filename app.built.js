/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

	'use strict';

	ns.log.exception = function () {
	    console.log(arguments);
	};

	// Урлы.
	ns.router.routes = {
	    route: {
	        '/photos/{image-id:int}': 'photo',
	        '/photos': 'photo',
	        '/': 'index'
	    }
	};

	// ----------------------------------------------------------------------------------------------------------------- //

	// Модели.
	ns.Model.define('photo', {
	    params: {
	        'image-id': null
	    }
	});

	ns.Model.define('photos', {
	    split: {
	        items: '.images.image',
	        model_id: 'photo',
	        params: {
	            'id': '.id'
	        }
	    }
	});

	// ----------------------------------------------------------------------------------------------------------------- //

	// Тестовые данные.
	var photos = ns.Model.get('photos').setData({ images: { image: [] } });
	photos.insert([ns.Model.get('photo', { 'image-id': 1 }).setData({ id: 1, url_: 'https://img-fotki.yandex.ru/get/56796/83105148.37/0_8f00e_6798e037_' }), ns.Model.get('photo', { 'image-id': 2 }).setData({ id: 2, url_: 'https://img-fotki.yandex.net/get/174613/90684498.e/0_STATICf0880_99482658_' }), ns.Model.get('photo', { 'image-id': 3 }).setData({ id: 3, url_: 'https://img4-fotki.yandex.net/get/167717/198922885.8d/0_STATIC1abaf4_b1f83682_' })]);

	// ----------------------------------------------------------------------------------------------------------------- //

	// React

	window.APP = React.createClass({
	    displayName: 'APP',

	    // бокс
	    _getContent: function _getContent() {
	        if (this.props.page === 'index') {
	            return React.createElement(
	                'div',
	                null,
	                '\u042D\u0442\u043E \u0438\u043D\u0434\u0435\u043A\u0441 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430. \u041D\u0430 \u043D\u0435\u0439 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435\u0442.',
	                React.createElement('br', null),
	                React.createElement('br', null),
	                '\u0417\u0430\u0442\u043E \u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A ',
	                React.createElement(
	                    'a',
	                    { href: ns.router.url('/photos') },
	                    '\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435'
	                ),
	                '.'
	            );
	        }
	        if (this.props.page === 'photo') {
	            return React.createElement(
	                'div',
	                null,
	                '\u041A \u043F\u0440\u0438\u043C\u0435\u0440\u0443, \u0432\u043E\u0442 \u0444\u043E\u0442\u043A\u0438:',
	                this._getPhotos(),
	                this.props.params['image-id'] ? this._getPhoto(this.props.params['image-id']) : null
	            );
	        }
	    },
	    _getPhotos: function _getPhotos() {
	        var _this = this;

	        return React.createElement(
	            'div',
	            null,
	            ns.Model.get('photos').models.map(function (model) {
	                return _this._getPhoto(model.get('.id'));
	            })
	        );
	    },

	    _getPhoto: function _getPhoto(id) {
	        var photo = ns.Model.get('photo', { 'image-id': id });

	        return React.createElement(
	            'a',
	            { href: ns.router.url('/photos/' + id) },
	            React.createElement('img', { src: photo.get('.url_') + 'XS' })
	        );
	    },
	    render: function render() {
	        return React.createElement(
	            'div',
	            null,
	            React.createElement(Head, null),
	            React.createElement(
	                'div',
	                { className: 'island' },
	                this._getContent()
	            )
	        );
	    }
	});
	var Head = React.createClass({
	    displayName: 'Head',
	    render: function render() {
	        return React.createElement(
	            'div',
	            { className: 'island head' },
	            '\u0428\u0430\u043F\u043A\u0430: \u043E\u043D\u0430 \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u043A \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435'
	        );
	    }
	});

	// ----------------------------------------------------------------------------------------------------------------- //

	ns.router.baseDir = location.pathname.substr(0, location.pathname.length - 1);

	ns.init();
	ns.page.go();

/***/ }
/******/ ]);