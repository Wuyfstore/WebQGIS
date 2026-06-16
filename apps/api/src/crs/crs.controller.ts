import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query } from "@nestjs/common";
import { CrsService } from "./crs.service.js";
import { CustomCrsParamDto } from "./dto/custom-crs-param.dto.js";
import { CrsSearchQueryDto } from "./dto/crs-search-query.dto.js";
import { UpsertCustomCrsDto } from "./dto/upsert-custom-crs.dto.js";

@Controller("crs")
export class CrsController {
  constructor(
    @Inject(CrsService)
    private readonly crsService: CrsService
  ) {}

  @Get("search")
  search(@Query() query: CrsSearchQueryDto) {
    return this.crsService.search(query);
  }

  @Get("custom")
  listCustom() {
    return this.crsService.listCustom();
  }

  @Post("custom")
  createCustom(@Body() dto: UpsertCustomCrsDto) {
    return this.crsService.createCustom(dto);
  }

  @Put("custom/:id")
  updateCustom(@Param() params: CustomCrsParamDto, @Body() dto: UpsertCustomCrsDto) {
    return this.crsService.updateCustom(params.id, dto);
  }

  @Delete("custom/:id")
  @HttpCode(204)
  deleteCustom(@Param() params: CustomCrsParamDto) {
    return this.crsService.deleteCustom(params.id);
  }
}
