ns.queue = [];

/**
 * @example
 *
 *    ```js
 *    <DataProvider model="photos" params={...}>
 *       {(status, data) => {
 *           switch (status) {
 *               case 'ok':
 *                   return <MySuperView prop1={data.foo} prop2={data.bar} />;
 *               case 'loading':
 *                   return <Spin />;
 *               case 'error':
 *                   return <Error />;
 *           }
 *       }}
 *   </DataProvider>
 *   ```
 */
module.exports = (props) => {
    const layout = props.children;
    const model = ns.Model.get(props.model, props.params);

    if (model.isValid()) {
        return layout('ok', model.getData());
    } else if (model.getError()) {
        return layout('error', model.getError());
    }
    ns.queue.push({
        id: props.model,
        params: props.params
    });
    return layout('loading');
}
