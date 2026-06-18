import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ChatwootService } from './chatwoot.service';

@Injectable()
export class ChatwootSyncService {
  private readonly logger = new Logger(ChatwootSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatwootService: ChatwootService,
  ) {}

  /**
   * Sync a platform user to Chatwoot as a contact.
   * Called when a user registers or updates their profile.
   */
  async syncUserToChatwoot(userId: number) {
    const config = await this.prisma.chatwootConfig.findFirst({
      where: { isEnabled: true, autoSyncUsers: true },
    });
    if (!config) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        username: true,
        firstName: true,
        lastName: true,
        vipTier: true,
        balance: true,
        createdAt: true,
      },
    });
    if (!user) return;

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      user.email ||
      `User ${user.id}`;

    try {
      // Search for existing contact by email or phone
      let existingContact: any = null;

      if (user.email) {
        const result = await this.chatwootService.searchContacts(user.email);
        existingContact = result?.payload?.[0];
      }

      if (!existingContact && user.phoneNumber) {
        const result = await this.chatwootService.searchContacts(user.phoneNumber);
        existingContact = result?.payload?.[0];
      }

      const contactData = {
        name,
        email: user.email || undefined,
        phone_number: user.phoneNumber || undefined,
        identifier: `platform_user_${user.id}`,
        custom_attributes: {
          platform_user_id: user.id,
          username: user.username,
          vip_tier: user.vipTier,
          balance: user.balance,
          registered_at: user.createdAt?.toISOString(),
        },
      };

      if (existingContact) {
        await this.chatwootService.updateContact(existingContact.id, contactData);
        this.logger.log(`Updated Chatwoot contact ${existingContact.id} for user ${userId}`);
      } else {
        await this.chatwootService.createContact(contactData);
        this.logger.log(`Created Chatwoot contact for user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to sync user ${userId} to Chatwoot: ${error.message}`);
    }
  }

  /**
   * Sync a Chatwoot contact back to a platform user (if matching email/phone found).
   * Called from webhook when contact_created or contact_updated.
   */
  async syncChatwootContactToUser(contact: any) {
    try {
      const email = contact.email;
      const phone = contact.phone_number;

      let user: any = null;

      if (email) {
        user = await this.prisma.user.findUnique({ where: { email } });
      }
      if (!user && phone) {
        user = await this.prisma.user.findUnique({ where: { phoneNumber: phone } });
      }

      if (user) {
        this.logger.log(
          `Chatwoot contact ${contact.id} matched platform user ${user.id}`,
        );
        // Update contact with platform user info
        await this.chatwootService.updateContact(contact.id, {
          identifier: `platform_user_${user.id}`,
          custom_attributes: {
            ...(contact.custom_attributes || {}),
            platform_user_id: user.id,
            username: user.username,
            vip_tier: user.vipTier,
          },
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to sync Chatwoot contact: ${error.message}`);
    }
  }

  /**
   * Bulk sync all platform users to Chatwoot contacts.
   * Triggered manually from admin panel.
   */
  async bulkSyncUsers(): Promise<{ synced: number; errors: number }> {
    const config = await this.prisma.chatwootConfig.findFirst({
      where: { isEnabled: true },
    });
    if (!config) return { synced: 0, errors: 0 };

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { not: null } },
          { phoneNumber: { not: null } },
        ],
      },
      select: { id: true },
    });

    let synced = 0;
    let errors = 0;

    for (const user of users) {
      try {
        await this.syncUserToChatwoot(user.id);
        synced++;
        // Rate limit: small delay between requests
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        errors++;
      }
    }

    this.logger.log(`Bulk sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  }

  /**
   * Get sync status — count of users with/without Chatwoot contacts.
   */
  async getSyncStatus() {
    const totalUsers = await this.prisma.user.count();
    const usersWithEmail = await this.prisma.user.count({
      where: { email: { not: null } },
    });
    const usersWithPhone = await this.prisma.user.count({
      where: { phoneNumber: { not: null } },
    });

    return {
      totalUsers,
      syncableUsers: usersWithEmail + usersWithPhone,
      usersWithEmail,
      usersWithPhone,
    };
  }
}
