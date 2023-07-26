import { assert } from "chai"
import { Context, Logger, LoggerMode } from "tyapi-core"
import { MysqlService } from "../src/db/database.service"

class ExtendedService extends MysqlService {
  constructor(context: Context) {
    super({
      host: "localhost",
      port: 3306,
      user: "admin",
      pass: "1234ABcde!",
      db: "kabany_auth"
    }, context);
    this.params.set("STATUS", "READY")
  }
  async connect() {
    await super.connect()
    this.params.set("STATUS", "CONNECTED")
  }
  async disconnect() {
    await super.disconnect()
    this.params.set("STATUS", "DISCONNECTED")
  }
  public getStatus() {
    return this.params.get("STATUS") as string
  }
}

describe("MysqlService", async () => {
  it("should create a connection with MySQL", async () => {
    let app = new Context()
    app.mountService("logger", new Logger(LoggerMode.Console, app))
    let service = new ExtendedService(app)
    assert.equal(service.getStatus(), "READY")
    await app.mountService("database", service)
    assert.equal(service.getStatus(), "CONNECTED")
    await service.query("show tables;")
    await app.unmountServices()
    assert.equal(service.getStatus(), undefined)
  })
})