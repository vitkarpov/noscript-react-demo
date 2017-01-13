## Изменения в NS

1. `ns.initMainView`
2. `ns.page.startUpdate`

## Спецификация DataProvider

HOC-компонент, задача которого:

- по указанным параметрам выбрать нужны экземпляры моделей
- если модельки невалидные: добавить их в очередь на загрузку
- если модельки валидные: достать данные
- сформировать определенный стейт (статус = готово и данные)
- передать деткам стейт в пропсы

```js
    <DataProvider model="id" params={...}>
       {(status, data) => {
           switch (status) {
               case 'ok':
                   return <MySuperView prop1={data.foo} prop2={data.bar} />;
               case 'loading':
                   return <Spin />;
               case 'error':
                   return <Error />;
           }
       }}
    </DataProvider>
```
