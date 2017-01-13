var DataProvider = require('./data-provider');

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
        items: '.images',
        model_id: 'photo',
        params: {
            'image-id': '.id'
        }
    },
    methods: {
        request() {
            return new Promise((res) => {
                setTimeout(() => {
                    this.setData({
                        images: [
                            { id: 1, url_: 'https://img-fotki.yandex.ru/get/56796/83105148.37/0_8f00e_6798e037_' },
                            { id: 2, url_: 'https://img-fotki.yandex.net/get/174613/90684498.e/0_STATICf0880_99482658_' },
                            { id: 3, url_: 'https://img4-fotki.yandex.net/get/167717/198922885.8d/0_STATIC1abaf4_b1f83682_' }
                        ]
                    });
                    res();
                }, 1000);
            });
        }
    }
});

// ----------------------------------------------------------------------------------------------------------------- //

// Экшена

ns.action.define('change-photo', function(e, params) {
    // все изменения моделей только в экшенах!
    ns.Model.get('photo', {
        'image-id': params.id
    }).set('.url_', 'https://img4-fotki.yandex.net/get/102548/104468197.e/0_STATICecb8c_79d89e82_');

    // когда все модели поменялись и мы уверены,
    // что все состояние приложения консистентно — запускаем апдейт
    ns.page.go();
});

// ----------------------------------------------------------------------------------------------------------------- //

// React

const Photo = ({ url, src }) => (
    <a href={url}>
        <img src={src + 'XS'} />
    </a>
);

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
                        this._getPhotoPreview(this.props.params['image-id']) :
                        null}
                </div>
            );
        }
    },
    _getPhotos() {
        return (
            <DataProvider model="photos">
                {(status, data) => {
                    switch (status) {
                        case 'ok':
                            return <div>{data.images.map(({ id }) => this._getPhoto(id))}</div>
                        case 'loading':
                            return <div>загрузка...</div>;
                        case 'error':
                            return <div>ошибка :(</div>;
                    }
                }}
            </DataProvider>
        );
    },
    _getPhotoPreview(id) {
        return (
            <div>
                {this._getPhoto(id)}
                <button onClick={() => {
                    ns.action.run('change-photo', { id });
                }}>
                    Поменять фоточку
                </button>
            </div>
        );
    },
    _getPhoto(id) {
        return (
            <DataProvider model="photo" params={{'image-id': id}} key={id}>
                {(status, data) => (
                    <Photo
                        url={ns.router.url('/photos/' + data.id)}
                        src={data.url_} />
                )}
            </DataProvider>
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
