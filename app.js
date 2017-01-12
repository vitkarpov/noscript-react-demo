ns.log.exception = function() {
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
photos.insert([
    ns.Model.get('photo', { 'image-id': 1 }).setData({ id: 1, url_: 'https://img-fotki.yandex.ru/get/56796/83105148.37/0_8f00e_6798e037_' }),
    ns.Model.get('photo', { 'image-id': 2 }).setData({ id: 2, url_: 'https://img-fotki.yandex.net/get/174613/90684498.e/0_STATICf0880_99482658_' }),
    ns.Model.get('photo', { 'image-id': 3 }).setData({ id: 3, url_: 'https://img4-fotki.yandex.net/get/167717/198922885.8d/0_STATIC1abaf4_b1f83682_' })
]);

// ----------------------------------------------------------------------------------------------------------------- //

// React

window.APP = React.createClass({
    // бокс
    _getContent() {
        if (this.props.page === 'index') {
            return (
                <div>
                    Это индекс страница. На ней ничего нет.
                    <br/>
                    <br/>
                    Зато можно перейти к <a href={ns.router.url('/photos')}>следующей странице</a>.
                </div>
            );
        }
        if (this.props.page === 'photo') {
            return (
                <div>
                    К примеру, вот фотки:
                    {this._getPhotos()}
                    {this.props.params['image-id'] ?
                        this._getPhoto(this.props.params['image-id']) :
                        null}
                </div>
            );
        }
    },
    _getPhotos() {
        return (
            <div>
                {ns.Model.get('photos').models.map(
                    (model) => this._getPhoto(model.get('.id'))
                )}
            </div>
        );
    },
    _getPhoto: function(id) {
        var photo = ns.Model.get('photo', { 'image-id': id });

        return (
            <a href={ns.router.url('/photos/' + id)}>
                <img src={photo.get('.url_') + 'XS'} />
            </a>
        );
    },
    render() {
        return (
            <div>
                <Head />
                <div className="island">
                    {this._getContent()}
                </div>
            </div>
        );
    }
});
var Head = React.createClass({
    render() {
        return <div className="island head">Шапка: она не меняется от страницы к странице</div>;
    }
});

// ----------------------------------------------------------------------------------------------------------------- //

ns.router.baseDir = location.pathname.substr(0, location.pathname.length - 1);

ns.init();
ns.page.go();
