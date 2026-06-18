import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ChatwootService {
  private readonly logger = new Logger(ChatwootService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getConfig() {
    const config = await this.prisma.chatwootConfig.findFirst({
      where: { isEnabled: true },
    });
    if (!config) throw new Error('Chatwoot is not configured');
    return config;
  }

  private async request(
    method: string,
    path: string,
    body?: any,
  ): Promise<any> {
    const config = await this.getConfig();
    const url = `${config.instanceUrl}/api/v1/accounts/${config.accountId}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        api_access_token: config.apiToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Chatwoot API ${method} ${path} failed: ${res.status} ${text}`);
      throw new Error(`Chatwoot API error: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res.text();
  }

  // ─── Messages ─────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: number,
    content: string,
    contentType: string = 'text',
    contentAttributes?: any,
    isPrivate: boolean = false,
  ) {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      content,
      message_type: isPrivate ? 'outgoing' : 'outgoing',
      private: isPrivate,
      content_type: contentType,
      content_attributes: contentAttributes,
    });
  }

  async sendPrivateNote(conversationId: number, content: string) {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      content,
      message_type: 'outgoing',
      private: true,
    });
  }

  // ─── Conversations ──────���─────────────────────────────────────────────

  async getConversation(conversationId: number) {
    return this.request('GET', `/conversations/${conversationId}`);
  }

  async getConversations(filters?: {
    status?: string;
    assignee_type?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assignee_type) params.append('assignee_type', filters.assignee_type);
    if (filters?.page) params.append('page', String(filters.page));
    const query = params.toString() ? `?${params}` : '';
    return this.request('GET', `/conversations${query}`);
  }

  async updateConversation(conversationId: number, data: any) {
    return this.request('PATCH', `/conversations/${conversationId}`, data);
  }

  async assignAgent(conversationId: number, agentId: number) {
    return this.request(
      'POST',
      `/conversations/${conversationId}/assignments`,
      { assignee_id: agentId },
    );
  }

  async addLabels(conversationId: number, labels: string[]) {
    return this.request('POST', `/conversations/${conversationId}/labels`, {
      labels,
    });
  }

  async toggleStatus(conversationId: number, status: 'open' | 'resolved' | 'pending') {
    return this.request(
      'POST',
      `/conversations/${conversationId}/toggle_status`,
      { status },
    );
  }

  // ─── Contacts ──���──────────────────────────────────────────────────────

  async createContact(data: {
    name?: string;
    email?: string;
    phone_number?: string;
    identifier?: string;
    custom_attributes?: Record<string, any>;
  }) {
    return this.request('POST', '/contacts', data);
  }

  async updateContact(contactId: number, data: any) {
    return this.request('PUT', `/contacts/${contactId}`, data);
  }

  async searchContacts(query: string) {
    return this.request('GET', `/contacts/search?q=${encodeURIComponent(query)}`);
  }

  async getContact(contactId: number) {
    return this.request('GET', `/contacts/${contactId}`);
  }

  // ─── Agents ─────────────────────────────────────��─────────────────────

  async getAgents() {
    return this.request('GET', '/agents');
  }

  // ─── Inboxes ────────────────────────────────────────────────────��─────

  async getInboxes() {
    return this.request('GET', '/inboxes');
  }

  // ─── Labels ────────────────────────────────────���──────────────────────

  async getLabels() {
    return this.request('GET', '/labels');
  }

  // ─── Teams ─────��─────────────────────────────────���────────────────────

  async getTeams() {
    return this.request('GET', '/teams');
  }

  // ─── Canned Responses ─────────────────────────────────────────────────

  async getCannedResponses() {
    return this.request('GET', '/canned_responses');
  }

  async createCannedResponse(data: { short_code: string; content: string }) {
    return this.request('POST', '/canned_responses', data);
  }

  // ─── Test Connection ──────────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const config = await this.getConfig();
      const url = `${config.instanceUrl}/api/v1/accounts/${config.accountId}`;
      const res = await fetch(url, {
        headers: { api_access_token: config.apiToken },
      });
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
