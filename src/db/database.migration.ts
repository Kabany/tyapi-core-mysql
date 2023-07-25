import { Context, DatabaseMigration, DatabaseMigrationHandler, Entity, EntityFindOneQueryOptions, EntityWhereOptions, Logger } from "tyapi-core";
import { MysqlService } from "./database.service";
import { queryCreateTable, queryFind, queryInsert, queryRemove } from "./database.entity";

export class MysqlMigration extends DatabaseMigration {
  override async up(_db: MysqlService): Promise<void> {
    // TODO: On Migration
  }

  override async down(_db: MysqlService): Promise<void> {
    // TODO: On Rollback
  }
}



const MIGRATION_HISTORY_TABLE = "db_migration_history"

class MysqlMigrationHistory extends Entity {
  id?: number
  migration_name?: string
  implemented_at?: Date
  constructor(data?: any) {
    super();
    if (data != null) {
      this.id = data.id;
      this.migration_name = data.migration_name;
      this.implemented_at = data.implemented_at;
    }
  }
  override async insert(db: MysqlService): Promise<number> {
    this.implemented_at = new Date();
    let q = queryInsert(db.getDatabaseName(), MIGRATION_HISTORY_TABLE, ["migration_name", "implemented_at"], this);
    let data = await db.query(q.query, q.params);
    this.id = data.result.insertId;
    return this.id!;
  }
  override async remove(db: MysqlService): Promise<number> {
    let q = queryRemove(db.getDatabaseName(), MIGRATION_HISTORY_TABLE, {id: this.id!});
    let data = await db.query(q.query, q.params);
    return data.result.affectedRows;
  }
  static async FindOne(db: MysqlService, whereOptions?: EntityWhereOptions, queryOptions?: EntityFindOneQueryOptions) {
    let q = queryFind(db.getDatabaseName(), MIGRATION_HISTORY_TABLE, whereOptions, queryOptions);
    let data = await db.query(q.query, q.params);
    if (data.result.length == 0) {
      return null;
    } else {
      return new MysqlMigrationHistory(data.result[0]);
    }
  }
}



export interface MysqlMigrationClass {
  name: string
  new(): MysqlMigration
}

export class MysqlMigrationHandler extends DatabaseMigrationHandler {
  protected context?: Context
  constructor(db: MysqlService, migrations: MysqlMigrationClass[], context?: Context) {
    super(db, migrations);
    this.context = context;
  }
  override async prepare(): Promise<void> {
    this.getLogger()?.info(MysqlMigrationHandler.name, "Checking database migration settings...");
    let db = this.db as MysqlService;
    await db.query(this.queryCreateSchema(db.getDatabaseName()));
    let table = queryCreateTable(db.getDatabaseName(), MIGRATION_HISTORY_TABLE, true)
      .addIntegerColumn("id", {autoincrement: true, primaryKey: true, nullable: false})
      .addStringColumn("migration_name", {nullable: false, type: "text"})
      .addDateColumn("implemented_at", {nullable: false})
      .toQuery();
    await db.query(table.query, table.params);
  }
  override async migrate(): Promise<void> {
    let db = this.db as MysqlService;
    for await (let migration of this.migrations) {
      let exist = await MysqlMigrationHistory.FindOne(db, {migration_name: migration.name});
      if (exist == null) {
        let m = new migration();
        await m.up(db);
        this.getLogger()?.info(MysqlMigrationHandler.name, `${migration.name} migration implemented successfully!`);
        let mh = new MysqlMigrationHistory({migration_name: migration.name});
        await mh.insert(db);
      }
    }
    this.getLogger()?.success(MysqlMigrationHandler.name, `Database is up to date!`);
  }
  override async rollback(): Promise<void> {
    let db = this.db as MysqlService;
    let reversed = [...this.migrations].reverse()
    for await (let migration of reversed) {
      let exist = await MysqlMigrationHistory.FindOne(db, {migration_name: migration.name});
      if (exist != null) {
        let m = new migration();
        await m.down(db);
        this.getLogger()?.info(MysqlMigrationHandler.name, `${migration.name} migration rollbacked successfully!`);
        await exist.remove(db);
        break;
      }
    }
    this.getLogger()?.success(MysqlMigrationHandler.name, `Done!`);
  }

  queryCreateSchema(dbName: string): string {
    return `create database if not exists ${dbName}`;
  }

  /** 
   * Returns the logger service
   */
   protected getLogger() {
    return this.context?.getServiceSafe("logger") as Logger | undefined;
  }
} 