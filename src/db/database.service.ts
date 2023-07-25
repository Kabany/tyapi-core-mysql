import * as mysql from "mysql";
import { Context, DatabaseService, TyapiError } from "tyapi-core";

const DB_ENGINE = "DB_ENGINE";
const DB_ENGINE_TYPE = "MYSQL";

const DB_HOST = "DB_HOST";
const DB_PORT = "DB_PORT";
const DB_USER = "DB_USER";
const DB_PASS = "DB_PASS";
const DB_NAME = "DB_NAME";

interface MysqlParamsInterface {
  host?: string
  port?: number
  user: string
  pass: string
  db: string
}

export class MysqlService extends DatabaseService {

  protected connection?: mysql.Connection;

  constructor(params: MysqlParamsInterface, context: Context) {
    let map = new Map()
    map.set(DB_ENGINE, DB_ENGINE_TYPE)
    map.set(DB_HOST, params.host || "localhost");
    map.set(DB_PORT, params.port || 3306);
    map.set(DB_USER, params.user);
    map.set(DB_PASS, params.pass);
    map.set(DB_NAME, params.db);
    super(map, context);
  }
  
  override async connect() {
    this.getLogger()?.info(MysqlService.name, `Creating a connection to the database ${this.params.get(DB_NAME)} on ${this.params.get(DB_HOST)}:${this.params.get(DB_PORT)}...`);
    this.connection = mysql.createConnection({
      host: this.params.get(DB_HOST),
      database: this.params.get(DB_NAME),
      port: this.params.get(DB_PORT),
      user: this.params.get(DB_USER),
      password: this.params.get(DB_PASS)
    });
    await new Promise<void>((resolve, reject) => {
      this.connection!.connect((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    this.getLogger()?.success(MysqlService.name, `Successfully connected to the database ${this.params.get(DB_NAME)}.`);
  }

  override async disconnect() {
    this.getLogger()?.info(MysqlService.name, `Disconnecting from the database ${this.params.get(DB_NAME)}...`);
    if (this.connection != null) {
      this.connection.destroy();
    }
    this.getLogger()?.success(MysqlService.name, `Successfully disconnected from the database ${this.params.get(DB_NAME)}.`);
  }

  override async beforeMount() {
    let errors: any = {}
    if (!this.params.has(DB_ENGINE)) {
      errors.dbEngine = "Not defined";
    }
    if (!this.params.has(DB_HOST)) {
      errors.dbHost = "Not defined";
    }
    if (!this.params.has(DB_PORT)) {
      errors.dbPort = "Not defined";
    }
    if (!this.params.has(DB_USER)) {
      errors.dbUser = "Not defined";
    }
    if (!this.params.has(DB_PASS)) {
      errors.dbPass = "Not defined";
    }
    if (!this.params.has(DB_NAME)) {
      errors.dbName = "Not defined";
    }

    if (Object.keys(errors).length > 0) {
      let msg = "Error with db parameters:\n";
      for (let key of Object.keys(errors)) {
        msg += `${key}: ${errors[key]}\n`;
      }
      throw new TyapiError(msg);
    }
  }

  /**
   * Perform a query to the database.
   * @param query SQL query
   * @param data Array of parameters used in the query
   * @returns 
   */
  override async query(query: string, data?: any[]) {
    return new Promise<any>((resolve, reject) => {
      this.connection!.query(query, data || [], (err, result, fields) => {
        if (err) {
          reject(err);
        } else {
          resolve({result, fields});
        }
      });
    });
  }

  /** Returns the schema name of the current connection. */
  getDatabaseName() {
    return this.params.get(DB_NAME);
  }
}





export class MultipleMysqlService extends DatabaseService {
  protected dbs: Map<string, MysqlService>
  constructor(context: Context) {
    let newMap: Map<string, any> = new Map();
    newMap.set(DB_ENGINE, "MULTI_MYSQL");
    super(newMap, context);
    this.dbs = new Map();
  }

  override async beforeMount(): Promise<void> {
    // Do nothing
  }
  override async onMount(): Promise<void> {
    // Do nothing
  }

  override async beforeUnmount(): Promise<void> {
    this.getLogger()?.info(MultipleMysqlService.name, "Disconnecting all MySQL connections...");
    let keys = this.dbs.keys();
    for await (let key of keys) {
      let db = this.dbs.get(key);
      await db?.beforeUnmount();
      await db?.onUnmount();
      this.dbs.delete(key);
    }
    this.getLogger()?.info(MultipleMysqlService.name, "Successfully disconnected from all MySQL connections.");
  }

  override async onUnmount(): Promise<void> {
    // Do nothing
  }

  /** Create a Mysql Database Service and add in the list of active connections. It throws an ´CoreError´ if there is not an active connection with the given name. */
  async createConnection(name: string, params: MysqlParamsInterface) {
    if (this.dbs.has(name)) {
      throw new TyapiError(`There is already a connection defined with the name '${name}'`);
    } else {
      let db = new MysqlService(params, this.context);
      await db.beforeMount();
      await db.onMount();
      this.dbs.set(name, db);
      this.getLogger()?.info(MultipleMysqlService.name, "New connection to the database was added in the pool.");
    }
  }

  /** Returns the connection with the given name. It throws an `CoreError` if there is not an active connection with the given name and there are not any parameters given to start a new connection. */
  async getConnection(name: string, params?: MysqlParamsInterface) {
    if (this.dbs.has(name)) {
      return this.dbs.get(name)!;
    } else if (params != null) {
      this.createConnection(name, params);
      return this.dbs.get(name)!;
    } else {
      throw new TyapiError(`No connection with the name '${name}' was found, and no parameters to create a new connection was provided.`);
    }
  }

  /** Close a connection with a given name. */
  async closeConnection(name: string) {
    if (this.dbs.has(name)) {
      let db = this.dbs.get(name)!;
      await db.beforeUnmount();
      await db.onUnmount();
      this.dbs.delete(name);
      this.getLogger()?.info(MultipleMysqlService.name, "A connection to the dataabase was removed from the pool.");
    }
  }

  /** Return the names of all active connections. */
  getDatabases() {
    return this.params.keys();
  }
}