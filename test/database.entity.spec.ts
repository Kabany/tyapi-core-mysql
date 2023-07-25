import { assert } from "chai"
import { queryAlterTable, queryCount, queryCreateTable, queryDropTable, queryFind, queryFindOne, queryInsert, queryRemove, queryRenameTable, queryUpdate } from "../src/db/database.entity"

const TABLE = "entity_test";
const DB = "database";

describe("MySQL Entity", async () => {
  it("queryInsert", async () => {
    let q = queryInsert(DB, TABLE, ["name", "vtext"], {name: "TheName", vtext: "TheValue"});
    assert.equal(q.query, "insert into database.entity_test (name,vtext) values (?,?);")
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
  })

  it("queryUpdate", async () => {
    let q = queryUpdate(DB, TABLE, ["name", "vtext"], {name: "TheName", vtext: "TheValue"}, {id: 1});
    assert.equal(q.query, "update database.entity_test  set name=?, vtext=? where id=?;");
    assert.equal(q.params.length, 3)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
    assert.equal(q.params[2], 1)
  })

  it("queryRemove", async () => {
    let q = queryRemove(DB, TABLE, {name: "TheName", vtext: "TheValue"});
    assert.equal(q.query, "delete from database.entity_test  where name=? and vtext=?;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
  })

  it("queryCount", async () => {
    let q = queryCount(DB, TABLE, {name: "TheName", vtext: "TheValue"});
    assert.equal(q.query, "select count(*) as total from database.entity_test  where name=? and vtext=? ;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
  })

  it("queryFindOne", async () => {
    let q = queryFindOne(DB, TABLE);
    assert.equal(q.query, "select * from database.entity_test     limit ? offset ?;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], 1)
    assert.equal(q.params[1], 0)
  })

  it("queryFind", async () => {
    let q = queryFind(DB, TABLE);
    assert.equal(q.query, "select * from database.entity_test     ;");
    assert.equal(q.params.length, 0)
  })

  it("queryFind where", async () => {
    let q = queryFind(DB, TABLE, {name: "TheName", vtext: "TheValue"});
    assert.equal(q.query, "select * from database.entity_test  where name=? and vtext=?   ;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
  })

  it("queryFind and or", async () => {
    let q = queryFind(DB, TABLE, {name: "TheName", $or: [{vtext: "TheValue"}, {vtext: "TheValue2"}]});
    assert.equal(q.query, "select * from database.entity_test  where name=? and ((vtext=?) or (vtext=?))   ;");
    assert.equal(q.params.length, 3)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
    assert.equal(q.params[2], "TheValue2")
  })

  it("queryFind and or 2", async () => {
    let q = queryFind(DB, TABLE, {name: "TheName", $or: [{vtext: "TheValue", id: 1}, {vtext: "TheValue2"}]});
    assert.equal(q.query, "select * from database.entity_test  where name=? and ((vtext=? and id=?) or (vtext=?))   ;");
    assert.equal(q.params.length, 4)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
    assert.equal(q.params[2], 1)
    assert.equal(q.params[3], "TheValue2")
  })

  it("queryFind eq and neq", async () => {
    let q = queryFind(DB, TABLE, {name: {$eq: "TheName"}, vtext: {$neq: "TheValue"}});
    assert.equal(q.query, "select * from database.entity_test  where name=? and vtext<>?   ;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], "TheName")
    assert.equal(q.params[1], "TheValue")
  })

  it("queryFind gt gte lt lte", async () => {
    let q = queryFind(DB, TABLE, {$or: [{name: {$gt: 1}, vtext: {$lte: 5}}, {name: {$gte: 2}, vtext: {$lt: 6}}]});
    assert.equal(q.query, "select * from database.entity_test  where (name>? and vtext<=?) or (name>=? and vtext<?)   ;");
    assert.equal(q.params.length, 4)
    assert.equal(q.params[0], 1)
    assert.equal(q.params[1], 5)
    assert.equal(q.params[2], 2)
    assert.equal(q.params[3], 6)
  })

  it("queryFind is, is not", async () => {
    let q = queryFind(DB, TABLE, {name: {$is: null}, vtext: {$not: null}});
    assert.equal(q.query, "select * from database.entity_test  where name is ? and vtext is not ?   ;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], null)
    assert.equal(q.params[1], null)
  })

  it("queryFind between, not between", async () => {
    let q = queryFind(DB, TABLE, {vtext: {$between: {$from: 1, $to: 10}}, name: {$nbetween: {$from: 10, $to: 20}}});
    assert.equal(q.query, "select * from database.entity_test  where (vtext between ? and ?) and (name not between ? and ?)   ;");
    assert.equal(q.params.length, 4)
    assert.equal(q.params[0], 1)
    assert.equal(q.params[1], 10)
    assert.equal(q.params[2], 10)
    assert.equal(q.params[3], 20)
  })

  it("queryFind in, not in", async () => {
    let q = queryFind(DB, TABLE, {name: {$in: [1,2]}, vtext: {$nin: [3,4]}});
    assert.equal(q.query, "select * from database.entity_test  where name in (?) and vtext not in (?)   ;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0].length, 2)
    assert.equal(q.params[0][0], 1)
    assert.equal(q.params[0][1], 2)
    assert.equal(q.params[1].length, 2)
    assert.equal(q.params[1][0], 3)
    assert.equal(q.params[1][1], 4)
  })

  it("queryFind in, not in", async () => {
    let q = queryFind(DB, TABLE, {name: {$in: [1,2]}, vtext: {$nin: [3,4]}});
    assert.equal(q.query, "select * from database.entity_test  where name in (?) and vtext not in (?)   ;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0].length, 2)
    assert.equal(q.params[0][0], 1)
    assert.equal(q.params[0][1], 2)
    assert.equal(q.params[1].length, 2)
    assert.equal(q.params[1][0], 3)
    assert.equal(q.params[1][1], 4)
  })

  it("queryFind limit", async () => {
    let q = queryFind(DB, TABLE, {}, {limit: {$per: 10, $page: 2}});
    assert.equal(q.query, "select * from database.entity_test     limit ? offset ?;");
    assert.equal(q.params.length, 2)
    assert.equal(q.params[0], 10)
    assert.equal(q.params[1], 10)
  })

  it("queryFind order by", async () => {
    let q = queryFind(DB, TABLE, {}, {order: {name: "asc", vtext: "desc"}});
    assert.equal(q.query, "select * from database.entity_test    order by name asc, vtext desc ;");
    assert.equal(q.params.length, 0)
  })

  it("queryFind select specific columns", async () => {
    let q = queryFind(DB, TABLE, {}, {columns: ["name", "vtext", {column: "name2"}, {column: "vtext", as: "val"}]});
    assert.equal(q.query, "select name, vtext, name2, vtext as val from database.entity_test     ;");
    assert.equal(q.params.length, 0)
  })

  it("queryFind table alias", async () => {
    let q = queryFind(DB, TABLE, {}, {tableAlias: "a"});
    assert.equal(q.query, "select * from database.entity_test as a     ;");
    assert.equal(q.params.length, 0)
  })

  it("queryFind join", async () => {
    let q = queryFind(DB, TABLE, {}, {tableAlias: "a", join: [{database: "kabany", table: "demo", tableAlias: "b", type: "inner", condition: {columnA: "a.foreignId", columnB: "b.keyId"}}]});
    assert.equal(q.query, "select * from database.entity_test as a inner join kabany.demo as b on a.foreignId = b.keyId    ;");
    assert.equal(q.params.length, 0)
  })

  it("queryCreateTable", async () => {
    let q = queryCreateTable("database", "entity_test").addIntegerColumn("id", {autoincrement: true, primaryKey: true}).addStringColumn("name", {nullable: true, defaultValue: "Luis"}).addDecimalColumn("total").addBooleanColumn("isDeleted").addDateColumn("created_at", {type: "datetime"}).toQuery();
    assert.equal(q.query, "create table database.entity_test (id int null auto_increment, primary key (id), name varchar null default ?, total decimal(10,2) null, isDeleted boolean null, created_at datetime null);");
    assert.equal(q.params.length, 1)
    assert.equal(q.params[0], "Luis")
  })

  it("queryDropTable", async () => {
    let q = queryDropTable("database", "entity_test");
    assert.equal(q.query, "drop table database.entity_test;");
    assert.equal(q.params.length, 0)
  })

  it("queryRenameTable", async () => {
    let q = queryRenameTable("database", "entity_old", "entity_new");
    assert.equal(q.query, "alter table database.entity_old rename to entity_new;");
    assert.equal(q.params.length, 0)
  })

  it("queryAlterTable", async () => {
    let q = queryAlterTable("database", "entity_test").addIntegerColumn("userId").updateToIntegerColumn("catalogId", "categoryId", {nullable: false})
    .addDecimalColumn("subtotal").updateToDecimalColumn("total", "general_total", {size: 10, decimals: 2})
    .addStringColumn("name", {unique: true}).updateToStringColumn("client_name", "lastName", {nullable: false})
    .addBooleanColumn("isDeleted", {defaultValue: false}).updateToBooleanColumn("allow_delete", "can_delete")
    .addDateColumn("isCreated").updateToDateColumn("isExpired", "isExpired", {type: "datetime"})
    .dropColumn("isUpdated")
    .toQuery();
    assert.equal(q.query, "alter table database.entity_test add column userId int null , change column catalogId categoryId int not null , add column subtotal decimal(10,2) null, change column total general_total decimal(10,2) null, add column name varchar null unique, change column client_name lastName varchar not null, add column isDeleted boolean null default ?, change column allow_delete can_delete boolean null, add column isCreated datetime null, change column isExpired isExpired datetime null, drop column isUpdated;");
    assert.equal(q.params.length, 1)
    assert.equal(q.params[0], false)
  })
})