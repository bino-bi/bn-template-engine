# bn-dataset

@Internal
Maps data-columns between DataSource and report components.
The SQL for the transformation is in the db-dataset body.


**Example**
```html
<bn-dataset datasources="examplesource" name="example">
  SELECT * from examplesource;
</bn-dataset>
```
<!-- Auto Generated Below -->


## Properties

| Property            | Attribute     | Description                                                                              | Type      | Default     |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------- | --------- | ----------- |
| `datasources`       | `datasources` | Commaseperated list of datasourcees <br /><br />  example: <br />  ```source1,source2``` | `string`  | `""`        |
| `name` _(required)_ | `name`        | Unique (template scope) name of the datasource                                           | `string`  | `undefined` |
| `static`            | `static`      |                                                                                          | `boolean` | `false`     |


----------------------------------------------

developed by Bino Bi
