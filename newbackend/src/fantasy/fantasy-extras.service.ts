import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';

import { FantasyConfig, FantasyConfigDocument } from './schemas/fantasy-config.schema';
import { FantasyPromocode, FantasyPromocodeDocument, FantasyPromoUsage, FantasyPromoUsageDocument } from './schemas/fantasy-promocode.schema';
import { FantasyStreak, FantasyStreakDocument, FantasyStreakReward, FantasyStreakRewardDocument } from './schemas/fantasy-streak.schema';
import { FantasyContestTemplate, FantasyContestTemplateDocument } from './schemas/fantasy-contest-template.schema';
import { FantasyPowerup, FantasyPowerupDocument } from './schemas/fantasy-powerup.schema';
import { FantasyPlayerCreditOverride, FantasyPlayerCreditOverrideDocument } from './schemas/fantasy-player-credit-override.schema';
import { FantasyNotification, FantasyNotificationDocument } from './schemas/fantasy-notification.schema';
import { FantasyActivityLog, FantasyActivityLogDocument } from './schemas/fantasy-activity-log.schema';
import { FantasyBonusRule, FantasyBonusRuleDocument } from './schemas/fantasy-bonus-rule.schema';
import { FantasyReferral, FantasyReferralDocument } from './schemas/fantasy-referral.schema';
import { FantasyContest, FantasyContestDocument } from './schemas/fantasy-contest.schema';
import { FantasyEntry, FantasyEntryDocument } from './schemas/fantasy-entry.schema';
import { FantasyTeam, FantasyTeamDocument } from './schemas/fantasy-team.schema';
import { FantasyMatch, FantasyMatchDocument } from './schemas/fantasy-match.schema';

import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function makeInviteCode(len = 6): string {
  const buf = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += INVITE_ALPHABET[buf[i] % INVITE_ALPHABET.length];
  return out;
}

@Injectable()
export class FantasyExtrasService {
  constructor(
    @InjectModel(FantasyConfig.name)              private configModel: Model<FantasyConfigDocument>,
    @InjectModel(FantasyPromocode.name)           private promoModel: Model<FantasyPromocodeDocument>,
    @InjectModel(FantasyPromoUsage.name)          private promoUsageModel: Model<FantasyPromoUsageDocument>,
    @InjectModel(FantasyStreak.name)              private streakModel: Model<FantasyStreakDocument>,
    @InjectModel(FantasyStreakReward.name)        private streakRewardModel: Model<FantasyStreakRewardDocument>,
    @InjectModel(FantasyContestTemplate.name)     private templateModel: Model<FantasyContestTemplateDocument>,
    @InjectModel(FantasyPowerup.name)             private powerupModel: Model<FantasyPowerupDocument>,
    @InjectModel(FantasyPlayerCreditOverride.name) private creditOverrideModel: Model<FantasyPlayerCreditOverrideDocument>,
    @InjectModel(FantasyNotification.name)        private notifModel: Model<FantasyNotificationDocument>,
    @InjectModel(FantasyActivityLog.name)         private logModel: Model<FantasyActivityLogDocument>,
    @InjectModel(FantasyBonusRule.name)           private bonusRuleModel: Model<FantasyBonusRuleDocument>,
    @InjectModel(FantasyReferral.name)            private referralModel: Model<FantasyReferralDocument>,
    @InjectModel(FantasyContest.name)             private contestModel: Model<FantasyContestDocument>,
    @InjectModel(FantasyEntry.name)               private entryModel: Model<FantasyEntryDocument>,
    @InjectModel(FantasyTeam.name)                private teamModel: Model<FantasyTeamDocument>,
    @InjectModel(FantasyMatch.name)               private matchModel: Model<FantasyMatchDocument>,
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  // ─── Config (singleton) ───────────────────────────────────────────────────

  async getConfig() {
    let cfg = await this.configModel.findOne({ key: 'singleton' }).lean();
    if (!cfg) {
      const created = await this.configModel.create({ key: 'singleton' });
      cfg = created.toObject();
    }
    return cfg;
  }

  async updateConfig(patch: Record<string, any>, adminUsername = 'system') {
    const cfg = await this.configModel.findOneAndUpdate(
      { key: 'singleton' },
      { $set: patch },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    await this.log('update-config', adminUsername, { payload: patch });
    return cfg;
  }

  // ─── Promocodes ────────────────────────────────────────────────────────────

  async listPromocodes() {
    return this.promoModel.find().sort({ createdAt: -1 }).lean();
  }

  async createPromocode(dto: any, adminUsername = 'system') {
    dto.code = String(dto.code).toUpperCase().trim();
    const p = await this.promoModel.create(dto);
    await this.log('create-promocode', adminUsername, { targetType: 'promocode', targetId: String(p._id), payload: dto });
    return p.toObject();
  }

  async updatePromocode(id: string, patch: any, adminUsername = 'system') {
    if (patch.code) patch.code = String(patch.code).toUpperCase().trim();
    const p = await this.promoModel.findByIdAndUpdate(id, patch, { returnDocument: 'after' }).lean();
    await this.log('update-promocode', adminUsername, { targetType: 'promocode', targetId: id, payload: patch });
    return p;
  }

  async deletePromocode(id: string, adminUsername = 'system') {
    await this.promoModel.findByIdAndDelete(id);
    await this.log('delete-promocode', adminUsername, { targetType: 'promocode', targetId: id });
    return { success: true };
  }

  /**
   * Check (not consume) a promocode for a candidate contest join.
   * Returns discount amount and final fee.
   */
  async applyPromocode(userId: number, opts: { code: string; entryFee: number; matchId?: number; contestType?: string }) {
    const code = String(opts.code || '').toUpperCase().trim();
    if (!code) throw new BadRequestException('Missing code');

    const promo = await this.promoModel.findOne({ code, isActive: true }).lean();
    if (!promo) throw new NotFoundException('Invalid or expired code');

    const now = new Date();
    if (promo.validFrom && now < new Date(promo.validFrom)) throw new BadRequestException('Code not active yet');
    if (promo.validTo && now > new Date(promo.validTo))     throw new BadRequestException('Code expired');
    if (promo.minEntryFee && opts.entryFee < promo.minEntryFee) {
      throw new BadRequestException(`Min entry ₹${promo.minEntryFee} required`);
    }
    if (promo.allowedMatches?.length && opts.matchId && !promo.allowedMatches.includes(opts.matchId)) {
      throw new BadRequestException('Code not valid for this match');
    }
    if (promo.allowedContestTypes?.length && opts.contestType && !promo.allowedContestTypes.includes(opts.contestType)) {
      throw new BadRequestException('Code not valid for this contest type');
    }
    if (promo.userSegment?.length && !promo.userSegment.includes(userId)) {
      throw new BadRequestException('Code not valid for this user');
    }
    if (promo.maxUsesTotal && promo.usesSoFar >= promo.maxUsesTotal) {
      throw new BadRequestException('Code usage limit reached');
    }

    const usage = await this.promoUsageModel.findOne({ userId, code }).lean();
    if (usage && promo.maxUsesPerUser && usage.count >= promo.maxUsesPerUser) {
      throw new BadRequestException('You have already used this code');
    }

    if (promo.firstTimeUserOnly) {
      const anyEntry = await this.entryModel.findOne({ userId }).lean();
      if (anyEntry) throw new BadRequestException('Code only valid for first-time players');
    }

    let discount = 0;
    if (promo.flatOff) discount = promo.flatOff;
    else if (promo.discountPercent) discount = Math.floor((opts.entryFee * promo.discountPercent) / 100);
    if (promo.maxDiscount && discount > promo.maxDiscount) discount = promo.maxDiscount;
    if (discount > opts.entryFee) discount = opts.entryFee;

    return {
      code, discount,
      finalFee: opts.entryFee - discount,
      description: promo.description,
    };
  }

  /** Mark a code as consumed (called from join flow). */
  async consumePromocode(userId: number, code: string) {
    code = String(code).toUpperCase().trim();
    if (!code) return;
    await Promise.all([
      this.promoModel.updateOne({ code }, { $inc: { usesSoFar: 1 } }),
      this.promoUsageModel.findOneAndUpdate(
        { userId, code },
        { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
        { upsert: true },
      ),
    ]);
  }

  // ─── Streaks ───────────────────────────────────────────────────────────────

  async getStreak(userId: number) {
    let s = await this.streakModel.findOne({ userId }).lean();
    if (!s) {
      const created = await this.streakModel.create({ userId });
      s = created.toObject();
    }
    const schedule = await this.getStreakSchedule();
    const today = todayUtc();
    const canClaim = s.lastClaimDate !== today;
    const nextDay = (s.currentStreak % schedule.length) + 1;
    return { ...s, canClaim, nextDay, schedule };
  }

  async getStreakSchedule() {
    let doc = await this.streakRewardModel.findOne({ key: 'default' }).lean();
    if (!doc) {
      const created = await this.streakRewardModel.create({ key: 'default' });
      doc = created.toObject();
    }
    return doc.schedule || [];
  }

  async updateStreakSchedule(schedule: any[], adminUsername = 'system') {
    const doc = await this.streakRewardModel.findOneAndUpdate(
      { key: 'default' },
      { $set: { schedule } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    await this.log('update-streak-schedule', adminUsername, { payload: { schedule } });
    return doc;
  }

  async claimStreak(userId: number) {
    const today = todayUtc();
    const yesterday = yesterdayUtc();

    const s = await this.streakModel.findOne({ userId });
    const streak = s ?? (await this.streakModel.create({ userId }));
    if (streak.lastClaimDate === today) throw new BadRequestException('Already claimed today');

    const continuesStreak = streak.lastClaimDate === yesterday;
    streak.currentStreak = continuesStreak ? streak.currentStreak + 1 : 1;
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastClaimDate = today;
    streak.totalDaysClaimed += 1;

    const schedule = await this.getStreakSchedule();
    const idx = (streak.currentStreak - 1) % schedule.length;
    const reward = schedule[idx] || { day: streak.currentStreak, amount: 5, type: 'bonus' };
    streak.lifetimeRewardAmount += reward.amount;
    await streak.save();

    // Credit bonus wallet (or grant powerup)
    if (reward.type === 'bonus' && reward.amount > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fiatBonus: { increment: reward.amount } },
      }).catch(() => null);
    } else if (reward.type === 'powerup' && reward.powerupType) {
      await this.powerupModel.findOneAndUpdate(
        { userId, type: reward.powerupType },
        { $inc: { count: 1 }, $setOnInsert: { source: 'streak' } },
        { upsert: true },
      );
    }

    await this.notify(userId, {
      type: 'streak',
      title: `Day ${streak.currentStreak} streak reward!`,
      body: reward.type === 'bonus' ? `₹${reward.amount} bonus credited` : `${reward.powerupType} powerup granted`,
    });

    return {
      streak: streak.toObject(),
      reward,
    };
  }

  // ─── Contest Templates ─────────────────────────────────────────────────────

  async listTemplates() {
    return this.templateModel.find().sort({ createdAt: -1 }).lean();
  }

  async createTemplate(dto: any, adminUsername = 'system') {
    const t = await this.templateModel.create(dto);
    await this.log('create-template', adminUsername, { targetType: 'template', targetId: String(t._id), payload: dto });
    return t.toObject();
  }

  async updateTemplate(id: string, patch: any, adminUsername = 'system') {
    const t = await this.templateModel.findByIdAndUpdate(id, patch, { returnDocument: 'after' }).lean();
    await this.log('update-template', adminUsername, { targetType: 'template', targetId: id, payload: patch });
    return t;
  }

  async deleteTemplate(id: string, adminUsername = 'system') {
    await this.templateModel.findByIdAndDelete(id);
    await this.log('delete-template', adminUsername, { targetType: 'template', targetId: id });
    return { success: true };
  }

  /** Spin up contests from selected templates for a given match. */
  async attachTemplatesToMatch(matchId: number, templateIds: string[], adminUsername = 'system') {
    const templates = await this.templateModel.find({ _id: { $in: templateIds }, isActive: true }).lean();
    const created: any[] = [];
    for (const t of templates) {
      const c = await this.contestModel.create({
        matchId,
        title: t.name,
        type: t.type,
        entryFee: t.entryFee,
        totalPrize: t.totalPrize,
        maxSpots: t.maxSpots,
        multiEntry: t.multiEntry || 1,
        isGuaranteed: !!t.isGuaranteed,
        prizeBreakdown: t.prizeBreakdown || [],
        icon: t.icon,
        accent: t.accent,
        isAutoCreated: true,
        templateId: String(t._id),
      });
      created.push(c.toObject());
    }
    await this.log('attach-templates', adminUsername, { targetType: 'match', targetId: String(matchId), payload: { templateIds, created: created.length } });
    return { created };
  }

  /**
   * Scan active "autoAttach" templates and attach them to any match that
   * doesn't yet have them. Meant to be called from triggerSync().
   */
  async autoAttachNewMatches() {
    const templates = await this.templateModel.find({ autoAttach: true, isActive: true }).lean();
    if (!templates.length) return { attached: 0 };
    const matches = await this.matchModel.find({ status: 1 }, { externalMatchId: 1, format: 1 }).lean();
    let attached = 0;
    for (const m of matches) {
      for (const t of templates) {
        if (t.autoFormats?.length && m.format && !t.autoFormats.includes(m.format)) continue;
        const already = await this.contestModel.exists({ matchId: m.externalMatchId, templateId: String(t._id) });
        if (already) continue;
        await this.contestModel.create({
          matchId: m.externalMatchId,
          title: t.name,
          type: t.type,
          entryFee: t.entryFee,
          totalPrize: t.totalPrize,
          maxSpots: t.maxSpots,
          multiEntry: t.multiEntry || 1,
          isGuaranteed: !!t.isGuaranteed,
          prizeBreakdown: t.prizeBreakdown || [],
          icon: t.icon,
          accent: t.accent,
          isAutoCreated: true,
          templateId: String(t._id),
        });
        attached++;
      }
    }
    return { attached };
  }

  // ─── Private Contests & Invites ────────────────────────────────────────────

  async createPrivateContest(userId: number, dto: any) {
    const cfg = await this.getConfig();
    if (!cfg.allowPrivateContests) throw new ForbiddenException('Private contests disabled');
    if (dto.maxSpots < 2 || dto.maxSpots > 100) throw new BadRequestException('Spots must be 2-100');
    if (dto.totalPrize > dto.entryFee * dto.maxSpots) {
      throw new BadRequestException('Prize pool cannot exceed entry fee × spots');
    }

    let code = makeInviteCode();
    for (let i = 0; i < 5; i++) {
      const clash = await this.contestModel.exists({ inviteCode: code });
      if (!clash) break;
      code = makeInviteCode();
    }

    const c = await this.contestModel.create({
      matchId: dto.matchId,
      title: dto.title,
      type: 'private',
      entryFee: dto.entryFee,
      totalPrize: dto.totalPrize,
      maxSpots: dto.maxSpots,
      multiEntry: dto.multiEntry || 1,
      prizeBreakdown: dto.prizeBreakdown || [{ rankFrom: 1, rankTo: 1, prize: dto.totalPrize }],
      isPrivate: true,
      inviteCode: code,
      creatorUserId: userId,
      isActive: true,
    });
    return c.toObject();
  }

  async resolveInvite(code: string) {
    code = String(code).toUpperCase().trim();
    const c = await this.contestModel.findOne({ inviteCode: code, isPrivate: true }).lean();
    if (!c) throw new NotFoundException('Invite code not found');
    return c;
  }

  // ─── Team Clone ────────────────────────────────────────────────────────────

  async cloneTeam(userId: number, sourceTeamId: string, newName?: string) {
    const cfg = await this.getConfig();
    if (!cfg.allowTeamCloning) throw new ForbiddenException('Team cloning disabled');

    const src = await this.teamModel.findById(sourceTeamId).lean();
    if (!src) throw new NotFoundException('Source team not found');
    if (src.userId !== userId) throw new ForbiddenException('Not your team');

    const count = await this.teamModel.countDocuments({ userId, matchId: src.matchId });
    if (count >= cfg.maxTeamsPerMatch) {
      throw new BadRequestException(`Max ${cfg.maxTeamsPerMatch} teams per match`);
    }

    const created = await this.teamModel.create({
      userId: src.userId,
      matchId: src.matchId,
      teamName: newName || `Team ${count + 1}`,
      players: src.players,
      captainId: src.captainId,
      viceCaptainId: src.viceCaptainId,
      totalCredits: src.totalCredits,
    });
    return created.toObject();
  }

  async listMyTeams(userId: number, matchId?: number) {
    const q: any = { userId };
    if (matchId) q.matchId = matchId;
    return this.teamModel.find(q).sort({ createdAt: -1 }).lean();
  }

  // ─── Powerups ──────────────────────────────────────────────────────────────

  async listPowerups(userId: number) {
    return this.powerupModel.find({ userId, count: { $gt: 0 } }).lean();
  }

  async grantPowerup(userId: number, type: string, count = 1, source = 'admin') {
    await this.powerupModel.findOneAndUpdate(
      { userId, type },
      { $inc: { count }, $setOnInsert: { source } },
      { upsert: true },
    );
    return { success: true };
  }

  async consumePowerups(userId: number, types: string[]) {
    for (const t of types) {
      const doc = await this.powerupModel.findOneAndUpdate(
        { userId, type: t, count: { $gt: 0 } },
        { $inc: { count: -1 } },
        { returnDocument: 'after' },
      );
      if (!doc) throw new BadRequestException(`Powerup "${t}" not available`);
    }
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async notify(userId: number | null, payload: { type: string; title: string; body: string; matchId?: number; contestId?: string; link?: string }) {
    const doc = await this.notifModel.create({ userId: userId ?? undefined, ...payload });
    if (userId) {
      this.events.server?.to(`user:${userId}`).emit('fantasy:notification', doc.toObject());
    } else {
      this.events.server?.emit('fantasy:notification', doc.toObject());
    }
    return doc.toObject();
  }

  async broadcastNotification(payload: any, adminUsername = 'system') {
    const { userIds, ...rest } = payload;
    if (Array.isArray(userIds) && userIds.length) {
      await Promise.all(userIds.map((uid: number) => this.notify(uid, rest)));
    } else {
      await this.notify(null, rest);
    }
    await this.log('broadcast-notification', adminUsername, { payload });
    return { success: true };
  }

  async listNotifications(userId: number, unreadOnly = false, limit = 50) {
    const q: any = { $or: [{ userId }, { userId: { $exists: false } }, { userId: null }] };
    if (unreadOnly) q.isRead = false;
    return this.notifModel.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async markRead(userId: number, notifId?: string) {
    if (notifId) {
      await this.notifModel.updateOne({ _id: notifId, userId }, { $set: { isRead: true, readAt: new Date() } });
    } else {
      await this.notifModel.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    }
    return { success: true };
  }

  // ─── Season leaderboard (across all completed matches) ─────────────────────

  async seasonLeaderboard(page = 1, limit = 50) {
    const rows = await this.entryModel.aggregate([
      { $match: { status: 'settled' } },
      {
        $group: {
          _id: '$userId',
          totalPoints:   { $sum: '$totalPoints' },
          totalWinnings: { $sum: '$winnings' },
          totalEntries:  { $sum: 1 },
          wins:          { $sum: { $cond: [{ $gt: ['$winnings', 0] }, 1, 0] } },
        },
      },
      { $sort: { totalPoints: -1, totalWinnings: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    const total = await this.entryModel.distinct('userId', { status: 'settled' }).then((u) => u.length);
    return {
      data: rows.map((r, i) => ({
        userId: r._id,
        rank: (page - 1) * limit + i + 1,
        totalPoints: r.totalPoints,
        totalWinnings: r.totalWinnings,
        totalEntries: r.totalEntries,
        wins: r.wins,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async myRank(userId: number) {
    const mine = await this.entryModel.aggregate([
      { $match: { userId, status: 'settled' } },
      { $group: { _id: null, totalPoints: { $sum: '$totalPoints' }, totalWinnings: { $sum: '$winnings' }, entries: { $sum: 1 }, wins: { $sum: { $cond: [{ $gt: ['$winnings', 0] }, 1, 0] } } } },
    ]);
    const myPts = mine[0]?.totalPoints || 0;
    const above = myPts > 0
      ? await this.entryModel.aggregate([
          { $match: { status: 'settled' } },
          { $group: { _id: '$userId', totalPoints: { $sum: '$totalPoints' } } },
          { $match: { totalPoints: { $gt: myPts } } },
          { $count: 'c' },
        ]).then(r => r[0]?.c || 0)
      : 0;
    return {
      rank: myPts > 0 ? above + 1 : null,
      totalPoints: myPts,
      totalWinnings: mine[0]?.totalWinnings || 0,
      entries: mine[0]?.entries || 0,
      wins: mine[0]?.wins || 0,
    };
  }

  // ─── Player credit overrides ───────────────────────────────────────────────

  async overrideCredit(matchId: number, playerId: number, newCredit: number, reason: string, adminUsername = 'system') {
    const o = await this.creditOverrideModel.findOneAndUpdate(
      { matchId, playerId },
      { $set: { newCredit, reason, adminUsername } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    // Also patch the live squad doc so the UI reflects immediately
    await this.matchModel.updateOne(
      { externalMatchId: matchId, 'squads.playerId': playerId },
      { $set: { 'squads.$.credit': newCredit } },
    );
    await this.log('override-credit', adminUsername, { targetType: 'match', targetId: String(matchId), payload: { playerId, newCredit, reason } });
    return o;
  }

  async listCreditOverrides(matchId?: number) {
    const q: any = {};
    if (matchId) q.matchId = matchId;
    return this.creditOverrideModel.find(q).sort({ updatedAt: -1 }).lean();
  }

  // ─── Manual points adjustment ──────────────────────────────────────────────

  async setManualPoints(matchId: number, playerId: number, points: number, reason: string, adminUsername = 'system') {
    await this.matchModel.updateOne(
      { externalMatchId: matchId },
      { $set: { [`fantasyPoints.${playerId}`]: points } },
      { upsert: false },
    );
    await this.log('manual-points', adminUsername, { targetType: 'match', targetId: String(matchId), payload: { playerId, points, reason } });
    return { success: true };
  }

  // ─── Contest cancel / refund / settle ──────────────────────────────────────

  async cancelContest(contestId: string, reason: string, refund = true, adminUsername = 'system') {
    const c = await this.contestModel.findById(contestId);
    if (!c) throw new NotFoundException('Contest not found');
    c.isActive = false;
    c.isCancelled = true;
    c.cancelReason = reason;
    await c.save();

    let refunded = 0;
    if (refund) {
      refunded = await this.refundContest(contestId, `cancelled: ${reason}`, adminUsername, /*alreadyCancelled*/ true);
    }

    await this.log('cancel-contest', adminUsername, { targetType: 'contest', targetId: contestId, payload: { reason, refunded } });
    return { success: true, refundedEntries: refunded };
  }

  async refundContest(contestId: string, reason = '', adminUsername = 'system', alreadyCancelled = false): Promise<number> {
    const entries = await this.entryModel.find({ contestId, isRefunded: { $ne: true } }).lean();
    let n = 0;
    for (const e of entries) {
      try {
        if (e.walletAmountUsed && e.walletAmountUsed > 0) {
          await this.prisma.user.update({
            where: { id: e.userId },
            data: { balance: { increment: e.walletAmountUsed } },
          });
        }
        if (e.bonusAmountUsed && e.bonusAmountUsed > 0) {
          await this.prisma.user.update({
            where: { id: e.userId },
            data: { fiatBonus: { increment: e.bonusAmountUsed } },
          });
        } else if (!e.walletAmountUsed && !e.bonusAmountUsed && e.entryFee > 0) {
          // Fallback to full wallet credit if legacy entries don't have split
          await this.prisma.user.update({
            where: { id: e.userId },
            data: { balance: { increment: e.entryFee } },
          });
        }
        await this.entryModel.updateOne(
          { _id: e._id },
          { $set: { status: 'refunded', isRefunded: true, refundedAt: new Date(), refundReason: reason } },
        );
        await this.notify(e.userId, {
          type: 'refund',
          title: 'Contest refunded',
          body: `₹${e.entryFee} credited back (${reason || 'admin refund'})`,
          contestId,
        });
        n++;
      } catch { /* continue */ }
    }
    if (!alreadyCancelled) {
      await this.log('refund-contest', adminUsername, { targetType: 'contest', targetId: contestId, payload: { reason, n } });
    }
    return n;
  }

  async settleContestByMatchPoints(contestId: string, note: string, adminUsername = 'system') {
    const c = await this.contestModel.findById(contestId).lean();
    if (!c) throw new NotFoundException('Contest not found');
    if (c.isCancelled) throw new BadRequestException('Contest is cancelled');

    const match = await this.matchModel.findOne({ externalMatchId: c.matchId }).lean();
    if (!match) throw new NotFoundException('Match not found');

    const entries = await this.entryModel.find({ contestId }).lean();
    if (!entries.length) return { settled: 0 };

    // 1) Compute per-team totals from match.fantasyPoints
    const teams = await this.teamModel.find({ _id: { $in: entries.map(e => e.teamId) } }).lean();
    const teamTotals = new Map<string, number>();
    for (const t of teams) {
      const pts = match.fantasyPoints || {};
      let total = 0;
      for (const p of t.players || []) {
        const base = pts[String(p.playerId)] || 0;
        const mult = p.isCaptain ? 2 : p.isViceCaptain ? 1.5 : 1;
        total += base * mult;
      }
      teamTotals.set(String(t._id), total);
    }

    // 2) Rank entries
    const ranked = entries
      .map(e => ({ entry: e, pts: teamTotals.get(String(e.teamId)) || 0 }))
      .sort((a, b) => b.pts - a.pts);
    ranked.forEach((r, i) => ((r as any).rank = i + 1));

    // 3) Pay winnings by prize breakdown
    let settled = 0;
    for (const r of ranked) {
      const rank = (r as any).rank as number;
      const prizeRow = (c.prizeBreakdown || []).find(b => rank >= b.rankFrom && rank <= b.rankTo);
      const winnings = prizeRow?.prize || 0;

      await this.entryModel.updateOne(
        { _id: r.entry._id },
        { $set: { rank, totalPoints: r.pts, winnings, status: 'settled' } },
      );
      await this.teamModel.updateOne(
        { _id: r.entry.teamId },
        { $set: { totalPoints: r.pts } },
      );
      if (winnings > 0) {
        await this.prisma.user.update({
          where: { id: r.entry.userId },
          data: { balance: { increment: winnings } },
        }).catch(() => null);
        await this.notify(r.entry.userId, {
          type: 'winnings',
          title: `You won ₹${winnings}!`,
          body: `Rank #${rank} in ${c.title} • ${r.pts.toFixed(1)} pts`,
          contestId,
          matchId: c.matchId,
        });
      }
      settled++;
    }

    await this.contestModel.updateOne(
      { _id: contestId },
      { $set: { isSettled: true, settledAt: new Date() } },
    );
    await this.log('settle-contest', adminUsername, { targetType: 'contest', targetId: contestId, payload: { settled, note } });
    return { settled };
  }

  async duplicateContest(contestId: string, adminUsername = 'system') {
    const src = await this.contestModel.findById(contestId).lean();
    if (!src) throw new NotFoundException('Contest not found');
    const { _id, filledSpots, isSettled, settledAt, isCancelled, cancelReason, createdAt, updatedAt, ...rest } = src as any;
    const c = await this.contestModel.create({
      ...rest,
      filledSpots: 0,
      isActive: true,
      isAutoCreated: false,
      title: `${rest.title} (copy)`,
      inviteCode: undefined,
    });
    await this.log('duplicate-contest', adminUsername, { targetType: 'contest', targetId: String(c._id), payload: { src: contestId } });
    return c.toObject();
  }

  // ─── Bonus Rules ───────────────────────────────────────────────────────────

  async listBonusRules() {
    return this.bonusRuleModel.find().lean();
  }

  async upsertBonusRule(dto: any, adminUsername = 'system') {
    const r = await this.bonusRuleModel.findOneAndUpdate(
      { trigger: dto.trigger },
      { $set: dto },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    await this.log('upsert-bonus-rule', adminUsername, { targetType: 'bonus-rule', targetId: String(r._id), payload: dto });
    return r;
  }

  // ─── Referral ──────────────────────────────────────────────────────────────

  async attachReferral(referrerId: number, refereeId: number, code: string) {
    if (referrerId === refereeId) throw new BadRequestException('Self-referral not allowed');
    const existing = await this.referralModel.findOne({ refereeId }).lean();
    if (existing) return existing;
    return (await this.referralModel.create({ referrerId, refereeId, referralCode: code, status: 'active' })).toObject();
  }

  async recordReferralEvent(refereeId: number, kind: string, amount: number, opts: { matchId?: number; contestId?: string } = {}) {
    const r = await this.referralModel.findOne({ refereeId });
    if (!r) return;
    r.events.push({ kind, amount, matchId: opts.matchId, contestId: opts.contestId, at: new Date() });
    r.totalEarned += amount;
    if (amount > 0) {
      await this.prisma.user.update({
        where: { id: r.referrerId },
        data: { fiatBonus: { increment: amount } },
      }).catch(() => null);
      await this.notify(r.referrerId, {
        type: 'referral',
        title: 'Referral reward',
        body: `₹${amount} credited from your referred user's ${kind}`,
      });
    }
    await r.save();
  }

  async myReferrals(userId: number) {
    const asReferrer = await this.referralModel.find({ referrerId: userId }).lean();
    const asReferee  = await this.referralModel.findOne({ refereeId: userId }).lean();
    const earned = asReferrer.reduce((s, r) => s + (r.totalEarned || 0), 0);
    return { asReferrer, asReferee, totalEarned: earned, count: asReferrer.length };
  }

  // ─── Activity log ──────────────────────────────────────────────────────────

  async log(action: string, adminUsername: string, extras: Partial<FantasyActivityLog> = {}) {
    try {
      await this.logModel.create({ action, adminUsername, ...extras });
    } catch { /* log failure shouldn't block */ }
  }

  async listActivityLog(page = 1, limit = 100, action?: string) {
    const q: any = {};
    if (action) q.action = action;
    const [rows, total] = await Promise.all([
      this.logModel.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.logModel.countDocuments(q),
    ]);
    return { data: rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ─── CSV export ────────────────────────────────────────────────────────────

  async exportEntriesCsv(matchId?: number, contestId?: string) {
    const q: any = {};
    if (matchId) q.matchId = Number(matchId);
    if (contestId) q.contestId = contestId;
    const rows = await this.entryModel.find(q).sort({ createdAt: -1 }).lean();
    const header = [
      'entryId', 'userId', 'matchId', 'contestId', 'teamId', 'entryFee',
      'walletAmountUsed', 'bonusAmountUsed', 'promocode', 'discountApplied',
      'rank', 'totalPoints', 'winnings', 'status', 'createdAt',
    ];
    const lines = [header.join(',')];
    for (const e of rows) {
      lines.push([
        e._id, e.userId, e.matchId, e.contestId, e.teamId, e.entryFee,
        e.walletAmountUsed || 0, e.bonusAmountUsed || 0,
        e.promocode || '', e.discountApplied || 0,
        e.rank || 0, e.totalPoints || 0, e.winnings || 0, e.status || '',
        e['createdAt'] ? new Date(e['createdAt'] as any).toISOString() : '',
      ].join(','));
    }
    return lines.join('\n');
  }

  // ─── Stats page ────────────────────────────────────────────────────────────

  async userFantasyStats(userId: number) {
    const [entriesAgg, teams, streak, powerups, notif, refs, rank] = await Promise.all([
      this.entryModel.aggregate([
        { $match: { userId } },
        { $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalSpent: { $sum: '$entryFee' },
            totalWinnings: { $sum: '$winnings' },
            totalPoints: { $sum: '$totalPoints' },
            wins: { $sum: { $cond: [{ $gt: ['$winnings', 0] }, 1, 0] } },
          } },
      ]),
      this.teamModel.countDocuments({ userId }),
      this.streakModel.findOne({ userId }).lean(),
      this.powerupModel.find({ userId, count: { $gt: 0 } }).lean(),
      this.notifModel.countDocuments({ userId, isRead: false }),
      this.referralModel.find({ referrerId: userId }).lean(),
      this.myRank(userId),
    ]);
    const e = entriesAgg[0] || { totalEntries: 0, totalSpent: 0, totalWinnings: 0, totalPoints: 0, wins: 0 };
    return {
      ...e,
      totalTeams: teams,
      netProfit: (e.totalWinnings || 0) - (e.totalSpent || 0),
      winRate: e.totalEntries ? +((e.wins / e.totalEntries) * 100).toFixed(1) : 0,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      powerups,
      unreadNotifications: notif,
      referrals: refs.length,
      referralEarned: refs.reduce((s, r) => s + (r.totalEarned || 0), 0),
      seasonRank: rank,
    };
  }

  // ─── Admin: Ban / unban user for fantasy ───────────────────────────────────

  async setUserFantasyBan(userId: number, banned: boolean, reason: string, adminUsername = 'system') {
    await this.prisma.user.update({
      where: { id: userId },
      data: { /* feature flag, extend schema if needed */ } as any,
    }).catch(() => null);
    await this.log(banned ? 'fantasy-ban' : 'fantasy-unban', adminUsername, {
      targetType: 'user', targetId: String(userId), payload: { reason },
    });
    return { success: true };
  }

  // ─── Admin: Disable match ──────────────────────────────────────────────────

  async setMatchDisabled(matchId: number, disabled: boolean, reason: string, adminUsername = 'system') {
    await this.matchModel.updateOne(
      { externalMatchId: matchId },
      { $set: { isDisabled: disabled, disableReason: disabled ? reason : '' } },
    );
    await this.log(disabled ? 'disable-match' : 'enable-match', adminUsername, {
      targetType: 'match', targetId: String(matchId), payload: { reason },
    });
    return { success: true };
  }
}
