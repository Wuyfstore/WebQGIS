import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { CreateDatasourceDto } from "./dto/create-datasource.dto.js";
import { DatasourceParamDto } from "./dto/datasource-param.dto.js";
import { DatasourcesService } from "./datasources.service.js";

@Controller("datasources")
export class DatasourcesController {
  constructor(
    @Inject(DatasourcesService)
    private readonly datasourcesService: DatasourcesService
  ) {}

  @Post("test")
  test(@Body() dto: CreateDatasourceDto) {
    return this.datasourcesService.test(dto);
  }

  @Post()
  create(@Body() dto: CreateDatasourceDto) {
    return this.datasourcesService.create(dto);
  }

  @Get()
  list() {
    return this.datasourcesService.list();
  }

  @Post(":id/scan")
  scan(@Param() params: DatasourceParamDto) {
    return this.datasourcesService.scan(params.id);
  }
}
