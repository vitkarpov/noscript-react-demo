module.exports = {
    entry: './app.js',
    output: {
        path: __dirname,
        filename: 'app.built.js'
    },
    module: {
        loaders: [{
            test: /\.js$/,
            loader: 'babel',
            query: {
                presets: ['es2015', 'react']
            }
        }]
    }
};
