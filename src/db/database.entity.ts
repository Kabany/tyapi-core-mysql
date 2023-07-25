import { EntityColumnReference, EntityCountQueryOptions, EntityFindOneQueryOptions, EntityFindQueryOptions, EntityJoin, EntityOrder, EntityRemoveQueryOptions, EntityUpdateQueryOptions, EntityWhereOptions, TyapiError } from "tyapi-core"

interface MysqlQuery {
  query: string
  params: any[]
}

function qselect(columns?: (string | EntityColumnReference)[]): string {
  if (columns == null || columns.length == 0) {
    return "select *";
  } else {
    let query = "select ";
    let isFirst = true;
    for (let column of columns) {
      if (isFirst) {
        isFirst = false;
      } else {
        query += ", ";
      }
      
      if (typeof column == "string") {
        query += column;
      } else if (typeof column == "object") {
        query += `${column.column}${column.as != null ? (" as " + column.as) : ""}`
      }
    }
    return query;
  }
}



function qwhereParams(key: string, obj: any): MysqlQuery {
  let data: MysqlQuery = {query: "", params: []};

  if (obj["$eq"] !== undefined) {
    data.query = `${key}=?`;
    data.params.push(obj["$eq"]);
  } else if (obj["$neq"] !== undefined) {
    data.query = `${key}<>?`;
    data.params.push(obj["$neq"]);
  } else if (obj["$gt"] !== undefined) {
    data.query = `${key}>?`;
    data.params.push(obj["$gt"]);
  } else if (obj["$gte"] !== undefined) {
    data.query = `${key}>=?`;
    data.params.push(obj["$gte"]);
  } else if (obj["$lt"] !== undefined) {
    data.query = `${key}<?`;
    data.params.push(obj["$lt"]);
  } else if (obj["$lte"] !== undefined) {
    data.query = `${key}<=?`;
    data.params.push(obj["$lte"]);
  } else if (obj["$is"] !== undefined) {
    data.query = `${key} is ?`;
    data.params.push(obj["$is"]);
  } else if (obj["$not"] !== undefined) {
    data.query = `${key} is not ?`;
    data.params.push(obj["$not"]);
  } else if (obj["$between"] !== undefined) {
    data.query = `(${key} between ? and ?)`;
    data.params.push(obj["$between"]["$from"], obj["$between"]["$to"]);
  } else if (obj["$nbetween"] !== undefined) {
    data.query = `(${key} not between ? and ?)`;
    data.params.push(obj["$nbetween"]["$from"], obj["$nbetween"]["$to"]);
  } else if (obj["$in"] !== undefined) {
    data.query = `${key} in (?)`;
    data.params.push(obj["$in"]);
  } else if (obj["$nin"] !== undefined) {
    data.query = `${key} not in (?)`;
    data.params.push(obj["$nin"]);
  } else {
    data.query = `${key}=?`;
    data.params.push(obj);
  }

  return data;
}

function qwhere(where: EntityWhereOptions, _subquery: boolean = false): MysqlQuery {
  let data: MysqlQuery = {query: "", params: []};

  let keys = Object.keys(where);
  if (keys.length) {
    let isFirst = true;
    if (_subquery) {
      data.query += "(";
    }
    for (let key of keys) {
      switch(key) {
        case "$and":
          if (isFirst) {
            isFirst = false;
            if (!_subquery) {
              data.query += "where ";
            }
            let and = qwhere(where[key] || {}, true);
            data.query += and.query;
            data.params.push(...and.params);
          } else {
            data.query += " and ";
          }
          break;
        case "$or":
          let needClose = false;
          let orFirst = true;
          let orOptions = where[key] || [];
          if (isFirst) {
            isFirst = false;
            if (!_subquery) {
              data.query += "where ";
            }
          } else {
            data.query += " and (";
            needClose = true;
          }
          for (let opt of orOptions) {
            let and = qwhere(opt, true);
            if (orFirst) {
              orFirst = false;
            } else {
              data.query += " or ";
            }
            data.query += and.query;
            data.params.push(...and.params);
          }
          if (needClose) {
            data.query += ")";
          }
          break;
        default:
          if (isFirst) {
            isFirst = false;
            if (!_subquery) {
              data.query += "where ";
            }
          } else {
            data.query += " and ";
          }
          let type = typeof where[key]
          if (where[key] === null || where[key] === undefined) {
            data.query += `${key} is null`;
          } else if (type == "object") {
            let c = qwhereParams(key, where[key])
            data.query += c.query;
            data.params.push(...c.params)
          } else {
            data.query += `${key}=?`;
            data.params.push(where[key]);
          }
          break;
      }
    }
  }
  if (_subquery) {
    data.query += ")";
  }
  
  return data;
}

function qreadjoin(join: EntityJoin): string {
  return `${join.type} join ${join.database}.${join.table}${join.tableAlias != null ? (" as " + join.tableAlias) : ""} on ${join.condition.columnA} = ${join.condition.columnB}`;
}

function qjoin(joins?: EntityJoin[]): string {
  let query = "";
  let isFirst = true;
  if (joins != null) {
    for (let join of joins) {
      if (isFirst) {
        isFirst = false
      } else {
        query += " "
      }
      query += qreadjoin(join);
    }
  }
  return query
}

function qgroupby(groups?: string[]): string {
  let query = "";
  let isFirst = true;
  if (groups != null && groups.length > 0) {
    for (let item of groups) {
      if (isFirst) {
        query += "group by ";
        isFirst = false;
      } else {
        query += ", ";
      }
      query += item;
    }
  }
  return query;
}

function qorderby(options?: EntityOrder): string {
  let query = "";
  let isFirst = true;
  if (options != null) {
    let keys = Object.keys(options);
    for (let key of keys) {
      if (isFirst) {
        query += "order by "
        isFirst = false
      } else {
        query += ", "
      }
      query += `${key} ${options[key]}`
    }
  }
  return query;
}

function qlimit(per = 100, page = 1): MysqlQuery {
  let data: MysqlQuery = {query: "limit ? offset ?", params: [per, (per * (page - 1))]}
  return data;
}

function qupdateColumns(columns: string[], values: any): MysqlQuery {
  let data: MysqlQuery = {query: "", params: []};

  let isFirst = true;
  for (let column of columns) {
    if (isFirst) {
      isFirst = false;
      data.query += "set ";
    } else {
      data.query += ", ";
    }
    data.query += `${column}=?`;
    data.params.push(values[column]);
  }

  return data;
}

function qinsertColumns(columns: string[], values: any): MysqlQuery {
  let data: MysqlQuery = {query: "", params: []};
  let q = "";

  let isFirst = true;
  for (let column of columns) {
    if (isFirst) {
      isFirst = false;
      data.query += `(${column}`
      q += "?"
    } else {
      data.query += `,${column}`
      q += `,?`
    }
    data.params.push(values[column])
  }
  if (data.params.length) {
    data.query += `) values (${q})`
  }

  return data;
}

export function queryFind(db: string, table: string, whereOptions?: EntityWhereOptions, queryOptions?: EntityFindQueryOptions): MysqlQuery {
  let s = qselect(queryOptions?.columns);
  let w = qwhere(whereOptions || {});
  let p = [...w.params]
  let t = queryOptions?.tableAlias != null ? ` as ${queryOptions?.tableAlias}` : ""
  let j = qjoin(queryOptions?.join)
  let g = qgroupby(queryOptions?.groupBy)
  let o = queryOptions != null ? qorderby(queryOptions.order) : ""
  let l = queryOptions != null && queryOptions.limit != null ? qlimit(queryOptions.limit.$per, queryOptions.limit.$page) : {query: "", params: []}
  p.push(...l.params)
  let q = `${s} from ${db}.${table}${t} ${j} ${w.query} ${g} ${o} ${l.query};`
  return {query: q, params: p}
}

export function queryFindOne(db: string, table: string, whereOptions?: EntityWhereOptions, queryOptions?: EntityFindOneQueryOptions): MysqlQuery {
  let s = qselect(queryOptions?.columns);
  let w = qwhere(whereOptions || {});
  let p = [...w.params]
  let t = queryOptions?.tableAlias != null ? ` as ${queryOptions?.tableAlias}` : ""
  let j = qjoin(queryOptions?.join)
  let g = qgroupby(queryOptions?.groupBy)
  let o = queryOptions != null ? qorderby(queryOptions.order) : ""
  let l = qlimit(1)
  p.push(...l.params)
  let q = `${s} from ${db}.${table}${t} ${j} ${w.query} ${g} ${o} ${l.query};`
  return {query: q, params: p};
}

export function queryCount(db: string, table: string, whereOptions?: EntityWhereOptions, queryOptions?: EntityCountQueryOptions): MysqlQuery {
  let s = "select count(*) as total";
  let w = qwhere(whereOptions || {});
  let t = queryOptions?.tableAlias != null ? ` as ${queryOptions?.tableAlias}` : ""
  let j = qjoin(queryOptions?.join)
  let g = qgroupby(queryOptions?.groupBy)
  let p = [...w.params]
  let q = `${s} from ${db}.${table}${t} ${j} ${w.query} ${g};`
  return {query: q, params: p};
}

export function queryRemove(db: string, table: string, whereOptions?: EntityWhereOptions, queryOptions?: EntityRemoveQueryOptions): MysqlQuery {
  let w = qwhere(whereOptions || {});
  let t = queryOptions?.tableAlias != null ? ` as ${queryOptions?.tableAlias}` : ""
  let j = qjoin(queryOptions?.join)
  let p = [...w.params]
  let q = `delete from ${db}.${table}${t} ${j} ${w.query};`
  return {query: q, params: p};
}

export function queryUpdate(db: string, table: string, columns: string[], values: any, whereOptions?: EntityWhereOptions, queryOptions?: EntityUpdateQueryOptions): MysqlQuery {
  let w = qwhere(whereOptions || {});
  let t = queryOptions?.tableAlias != null ? ` as ${queryOptions?.tableAlias}` : ""
  let j = qjoin(queryOptions?.join)
  let c = qupdateColumns(columns, values);
  let p: any[] = []
  p.push(...c.params);
  p.push(...w.params);
  let q = `update ${db}.${table}${t} ${j} ${c.query} ${w.query};`
  return {query: q, params: p};
}

export function queryInsert(db: string, table: string, columns: string[], values: any) {
  let c = qinsertColumns(columns, values)
  let q = `insert into ${db}.${table} ${c.query};`
  return {query: q, params: c.params};
}



interface IntegerColumnOptions {
  nullable?: boolean
  size?: number
  defaultValue?: number
  primaryKey?: boolean
  autoincrement?: boolean
  unique?: boolean
}

interface DecimalColumnOptions {
  nullable?: boolean
  size: number
  decimals: number
  defaultValue?: number
}

interface StringColumnOptions {
  nullable?: boolean
  size?: number
  defaultValue?: string
  type?: "varchar" | "text" | "longtext"
  primaryKey?: boolean
  unique?: boolean
}

interface BooleanColumnOptions {
  nullable?: boolean
  defaultValue?: boolean
}

interface DateColumnOptions {
  nullable?: boolean
  type?: "datetime" | "date"
}

class MysqlCreateTableQuery {
  private db: string
  private table: string
  private columns: string[]
  private data: MysqlQuery
  private ifNotExists: boolean
  constructor(db: string, table: string, ifNotExists: boolean = false) {
    this.db = db;
    this.table = table;
    this.data = {query: "", params: []};
    this.columns = [];
    this.ifNotExists = ifNotExists;
  }
  addIntegerColumn(name: string, options: IntegerColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let s = options.size || null;
    let dv = options.defaultValue;
    let pk = options.primaryKey === undefined ? false : options.primaryKey;
    let ai = options.autoincrement === undefined ? false : options.autoincrement;
    let u = options.unique === undefined ? false : options.unique;
    let query = `${name} int${s == null ? "" : ("(" + s + ")")} ${nul ? "null" : "not null"} ${u ? "unique " : ""}${ai ? "auto_increment" : ""}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    if (pk) {
      query += `, primary key (${name})`;
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addDecimalColumn(name: string, options: DecimalColumnOptions = {size: 10, decimals: 2}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let query = `${name} decimal(${options.size},${options.decimals}) ${nul ? "null" : "not null"}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addStringColumn(name: string, options: StringColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let t = options.type || "varchar";
    let s = options.size || null;
    let pk = options.primaryKey === undefined ? false : options.primaryKey;
    let u = options.unique === undefined ? false : options.unique;
    let query = `${name} ${t}${s == null ? "" : ("(" + s + ")")} ${nul ? "null" : "not null"}${u ? " unique" : ""}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    if (pk) {
      query += `, primary key (${name})`;
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addBooleanColumn(name: string, options: BooleanColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name)
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let query = `${name} boolean ${nul ? "null" : "not null"}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addDateColumn(name: string, options: DateColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let t = options.type || "datetime";
    let query = `${name} ${t} ${nul ? "null" : "not null"}`;
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    return this;
  }
  toQuery() {
    this.data.query = `create table ${this.ifNotExists ? 'if not exists ' : ''}${this.db}.${this.table} (${this.data.query});`;
    return this.data;
  }
}

export function queryCreateTable(db: string, table: string, ifNotExists: boolean = false) {
  return new MysqlCreateTableQuery(db, table, ifNotExists)
}

export function queryDropTable(db: string, table: string, ifNotExists: boolean = false) {
  let data: MysqlQuery = {query: `drop table ${ifNotExists ? 'if exists ' : ''}${db}.${table};`, params: []};
  return data;
}

export function queryRenameTable(db: string, oldName: string, newName: string) {
  let data: MysqlQuery = {query: `alter table ${db}.${oldName} rename to ${newName};`, params: []};
  return data;
}







interface AddIntegerColumnOptions extends IntegerColumnOptions {
  after?: "FIRST" | string
}
interface AddDecimalColumnOptions extends DecimalColumnOptions {
  after?: "FIRST" | string
}
interface AddStringColumnOptions extends StringColumnOptions {
  after?: "FIRST" | string
}
interface AddBooleanColumnOptions extends BooleanColumnOptions {
  after?: "FIRST" | string
}
interface AddDateColumnOptions extends DateColumnOptions {
  after?: "FIRST" | string
}

class MysqlAlterTableQuery {
  private db: string
  private table: string
  private data: MysqlQuery
  private columns: string[]
  constructor(db: string, table: string) {
    this.db = db;
    this.table = table;
    this.data = {query: "", params: []};
    this.columns = [];
  }
  addIntegerColumn(name: string, options: AddIntegerColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table alter`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let s = options.size || null;
    let dv = options.defaultValue;
    let pk = options.primaryKey === undefined ? false : options.primaryKey;
    let ai = options.autoincrement === undefined ? false : options.autoincrement;
    let u = options.unique === undefined ? false : options.unique;
    let pos = options.after || null;
    if (pos == "FIRST") {
      pos = " first";
    } else if (pos != null) {
      pos = ` after ${pos}`;
    } else {
      pos = "";
    }
    let query = `add column ${name} int${s == null ? "" : ("(" + s + ")")} ${nul ? "null" : "not null"} ${u ? "unique " : ""}${ai ? "auto_increment" : ""}${pos}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    if (pk) {
      query += `, primary key (${name})`;
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  updateToIntegerColumn(currentName: string, newName: string, options: IntegerColumnOptions = {}) {
    if (this.columns.indexOf(currentName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${currentName}' defined in the table alter`);
    } else if (this.columns.indexOf(newName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${newName}' defined in the table alter`);
    }
    this.columns.push(currentName, newName);
    let nul = options.nullable === undefined ? true : options.nullable;
    let s = options.size || null;
    let dv = options.defaultValue;
    let pk = options.primaryKey === undefined ? false : options.primaryKey;
    let ai = options.autoincrement === undefined ? false : options.autoincrement;
    let u = options.unique === undefined ? false : options.unique;
    let query = `change column ${currentName} ${newName} int${s == null ? "" : ("(" + s + ")")} ${nul ? "null" : "not null"} ${u ? "unique " : ""}${ai ? "auto_increment" : ""}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    if (pk) {
      query += `, primary key (${name})`;
    }
    this.data.query += `${this.columns.length > 2 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addDecimalColumn(name: string, options: AddDecimalColumnOptions = {size: 10, decimals: 2}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let pos = options.after || null;
    if (pos == "FIRST") {
      pos = " first";
    } else if (pos != null) {
      pos = ` after ${pos}`;
    } else {
      pos = "";
    }
    let query = `add column ${name} decimal(${options.size},${options.decimals}) ${nul ? "null" : "not null"}${pos}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  updateToDecimalColumn(currentName: string, newName: string, options: DecimalColumnOptions = {size: 10, decimals: 2}) {
    if (this.columns.indexOf(currentName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${currentName}' defined in the table alter`);
    } else if (this.columns.indexOf(newName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${newName}' defined in the table alter`);
    }
    this.columns.push(currentName, newName);
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let query = `change column ${currentName} ${newName} decimal(${options.size},${options.decimals}) ${nul ? "null" : "not null"}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 2 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addStringColumn(name: string, options: AddStringColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let t = options.type || "varchar";
    let s = options.size || null;
    let u = options.unique === undefined ? false : options.unique;
    let pos = options.after || null;
    if (pos == "FIRST") {
      pos = " first";
    } else if (pos != null) {
      pos = ` after ${pos}`;
    } else {
      pos = "";
    }
    let query = `add column ${name} ${t}${s == null ? "" : ("(" + s + ")")} ${nul ? "null" : "not null"}${u ? " unique" : ""}${pos}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  updateToStringColumn(currentName: string, newName: string, options: StringColumnOptions = {}) {
    if (this.columns.indexOf(currentName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${currentName}' defined in the table alter`);
    } else if (this.columns.indexOf(newName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${newName}' defined in the table alter`);
    }
    this.columns.push(currentName, newName);
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let t = options.type || "varchar";
    let s = options.size || null;
    let u = options.unique === undefined ? false : options.unique;
    let query = `change column ${currentName} ${newName} ${t}${s == null ? "" : ("(" + s + ")")} ${nul ? "null" : "not null"}${u ? " unique" : ""}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 2 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addBooleanColumn(name: string, options: AddBooleanColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name)
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let pos = options.after || null;
    if (pos == "FIRST") {
      pos = " first";
    } else if (pos != null) {
      pos = ` after ${pos}`;
    } else {
      pos = "";
    }
    let query = `add column ${name} boolean ${nul ? "null" : "not null"}${pos}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  updateToBooleanColumn(currentName: string, newName: string, options: BooleanColumnOptions = {}) {
    if (this.columns.indexOf(currentName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${currentName}' defined in the table alter`);
    } else if (this.columns.indexOf(newName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${newName}' defined in the table alter`);
    }
    this.columns.push(currentName, newName)
    let nul = options.nullable === undefined ? true : options.nullable;
    let dv = options.defaultValue;
    let query = `change column ${currentName} ${newName} boolean ${nul ? "null" : "not null"}`;
    let params: any[] = [];
    if (dv !== undefined) {
      query += ` default ?`;
      params.push(dv);
    }
    this.data.query += `${this.columns.length > 2 ? ", " : ""}${query}`;
    if (params.length) {
      this.data.params.push(...params);
    }
    return this;
  }
  addDateColumn(name: string, options: AddDateColumnOptions = {}) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let nul = options.nullable === undefined ? true : options.nullable;
    let t = options.type || "datetime";
    let pos = options.after || null;
    if (pos == "FIRST") {
      pos = " first";
    } else if (pos != null) {
      pos = ` after ${pos}`;
    } else {
      pos = "";
    }
    let query = `add column ${name} ${t} ${nul ? "null" : "not null"}`;
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    return this;
  }
  updateToDateColumn(currentName: string, newName: string, options: AddDateColumnOptions = {}) {
    if (this.columns.indexOf(currentName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${currentName}' defined in the table alter`);
    } else if (this.columns.indexOf(newName) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${newName}' defined in the table alter`);
    }
    this.columns.push(currentName, newName);
    let nul = options.nullable === undefined ? true : options.nullable;
    let t = options.type || "datetime";
    let pos = options.after || null;
    if (pos == "FIRST") {
      pos = " first";
    } else if (pos != null) {
      pos = ` after ${pos}`;
    } else {
      pos = "";
    }
    let query = `change column ${currentName} ${newName} ${t} ${nul ? "null" : "not null"}`;
    this.data.query += `${this.columns.length > 2 ? ", " : ""}${query}`;
    return this;
  }
  dropColumn(name: string) {
    if (this.columns.indexOf(name) >= 0) {
      throw new TyapiError(`Duplicated column with the name '${name}' defined in the table creation`);
    }
    this.columns.push(name);
    let query = `drop column ${name}`;
    this.data.query += `${this.columns.length > 1 ? ", " : ""}${query}`;
    return this;
  }
  toQuery() {
    this.data.query = `alter table ${this.db}.${this.table} ${this.data.query};`;
    return this.data;
  }
}

export function queryAlterTable(db: string, table: string) {
  return new MysqlAlterTableQuery(db, table)
}