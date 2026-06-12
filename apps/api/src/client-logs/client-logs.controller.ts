import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ClientLogsService } from "./client-logs.service.js";
import { CreateClientLogDto } from "./dto/create-client-log.dto.js";

@Controller("client-logs")
export class ClientLogsController {
  constructor(private readonly clientLogsService: ClientLogsService) {}

  @Get()
  list(@Query("limit") limit?: number) {
    return this.clientLogsService.listRecent(limit);
  }

  @Post()
  @HttpCode(202)
  create(@Body() dto: CreateClientLogDto) {
    return this.clientLogsService.create(dto);
  }
}
