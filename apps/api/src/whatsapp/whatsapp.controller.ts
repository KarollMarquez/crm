import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('webhook')
async verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    return this.whatsAppService.verifyWebhook(mode, token, challenge);
  }

  @Post('message')
async send(@Body('phoneNumber') phoneNumber: string, @Body('message') message: string) {
    return this.whatsAppService.sendMessage(phoneNumber, message);
  }
}