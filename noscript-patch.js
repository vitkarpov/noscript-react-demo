/**
 * Нет больше ns-видов,
 * соответственно ns.View.create('app') не нужен
 */
ns.initMainView = function() {};

ns.page.startUpdate = function(route) {
    ReactDOM.render(
        React.createElement(window.APP, route), document.getElementById('app'),
        function() {
            if (ns.queue.length > 0) {
                ns.request(ns.queue).then(function() {
                    ns.queue = [];
                    ns.page.startUpdate(route);
                });
            }
        }
    );
}
