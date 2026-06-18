import { IsNumber, IsString, IsArray, IsBoolean, IsOptional, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateTeamPlayerDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  playerId: number;

  @IsString()
  name: string;

  @IsString()
  role: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  teamId: number;

  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? 0 : Number(value)))
  @IsNumber()
  credit?: number;

  @IsBoolean()
  isCaptain: boolean;

  @IsBoolean()
  isViceCaptain: boolean;
}

export class CreateFantasyTeamDto {
  @IsNumber()
  matchId: number;

  @IsString()
  @IsOptional()
  teamName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(11)
  @ValidateNested({ each: true })
  @Type(() => CreateTeamPlayerDto)
  players: CreateTeamPlayerDto[];
}

export class JoinContestDto {
  @IsString()
  contestId: string;

  @IsString()
  teamId: string;

  @IsNumber()
  matchId: number;

  @IsOptional()
  @IsString()
  promocode?: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;

  @IsOptional()
  @IsArray()
  powerupsUsed?: string[];
}

export class ApplyPromocodeDto {
  @IsString()
  code: string;

  @IsNumber()
  entryFee: number;

  @IsOptional()
  @IsNumber()
  matchId?: number;

  @IsOptional()
  @IsString()
  contestType?: string;
}

export class CreatePrivateContestDto {
  @IsNumber()
  matchId: number;

  @IsString()
  title: string;

  @IsNumber()
  entryFee: number;

  @IsNumber()
  totalPrize: number;

  @IsNumber()
  maxSpots: number;

  @IsOptional()
  @IsNumber()
  multiEntry?: number;

  @IsOptional()
  @IsArray()
  prizeBreakdown?: Array<{ rankFrom: number; rankTo: number; prize: number }>;
}

export class CloneTeamDto {
  @IsString()
  sourceTeamId: string;

  @IsOptional()
  @IsString()
  newName?: string;
}

export class JoinByInviteDto {
  @IsString()
  inviteCode: string;

  @IsString()
  teamId: string;
}

export class MatchListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  status?: number; // 1=Upcoming, 2=Result/Completed, 3=Live, 4=Cancelled

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  competitionId?: number;

  /** Pass managed=1 to return only pre_squad=true (locked player credits) matches */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  @IsBoolean()
  managed?: boolean;
}

export class UpdatePointsSystemDto {
  @IsString()
  format: string;

  @IsOptional() @IsNumber() run?: number;
  @IsOptional() @IsNumber() boundary?: number;
  @IsOptional() @IsNumber() six?: number;
  @IsOptional() @IsNumber() halfCentury?: number;
  @IsOptional() @IsNumber() century?: number;
  @IsOptional() @IsNumber() duck?: number;
  @IsOptional() @IsNumber() wicket?: number;
  @IsOptional() @IsNumber() bowlingThreeWickets?: number;
  @IsOptional() @IsNumber() bowlingFiveWickets?: number;
  @IsOptional() @IsNumber() maiden?: number;
  @IsOptional() @IsNumber() catch_points?: number;
  @IsOptional() @IsNumber() stumping?: number;
  @IsOptional() @IsNumber() runOut?: number;
  @IsOptional() @IsNumber() playerOfTheMatch?: number;
  @IsOptional() @IsNumber() captainMultiplier?: number;
  @IsOptional() @IsNumber() viceCaptainMultiplier?: number;
  @IsOptional() @IsNumber() playing11Bonus?: number;
}

export class CreateContestDto {
  @IsNumber()
  matchId: number;

  @IsString()
  title: string;

  @IsString()
  type: string;

  @IsNumber()
  entryFee: number;

  @IsNumber()
  totalPrize: number;

  @IsNumber()
  maxSpots: number;

  @IsOptional()
  @IsNumber()
  multiEntry?: number;

  @IsOptional()
  @IsBoolean()
  isGuaranteed?: boolean;

  @IsOptional()
  @IsArray()
  prizeBreakdown?: Array<{
    rankFrom: number;
    rankTo: number;
    prize: number;
  }>;
}

// ═══════════════════════════════════════
//  ADMIN DTOs
// ═══════════════════════════════════════

export class UpdateFantasyConfigDto {
  @IsOptional() @IsNumber()  creditCap?: number;
  @IsOptional() @IsNumber()  squadSize?: number;
  @IsOptional() @IsNumber()  maxPlayersFromOneTeam?: number;
  @IsOptional() @IsNumber()  minKeepers?: number;
  @IsOptional() @IsNumber()  maxKeepers?: number;
  @IsOptional() @IsNumber()  minBatsmen?: number;
  @IsOptional() @IsNumber()  maxBatsmen?: number;
  @IsOptional() @IsNumber()  minAllrounders?: number;
  @IsOptional() @IsNumber()  maxAllrounders?: number;
  @IsOptional() @IsNumber()  minBowlers?: number;
  @IsOptional() @IsNumber()  maxBowlers?: number;
  @IsOptional() @IsNumber()  maxTeamsPerMatch?: number;
  @IsOptional() @IsNumber()  defaultMultiEntryCap?: number;
  @IsOptional() @IsNumber()  platformFeePercent?: number;
  @IsOptional() @IsNumber()  maxBonusUsePercent?: number;
  @IsOptional() @IsNumber()  signupBonus?: number;
  @IsOptional() @IsNumber()  firstJoinBonus?: number;
  @IsOptional() @IsNumber()  referrerBonus?: number;
  @IsOptional() @IsNumber()  refereeBonus?: number;
  @IsOptional() @IsNumber()  lockOffsetMinutes?: number;
  @IsOptional() @IsBoolean() allowPrivateContests?: boolean;
  @IsOptional() @IsBoolean() allowTeamCloning?: boolean;
  @IsOptional() @IsBoolean() allowMultiEntry?: boolean;
  @IsOptional() @IsBoolean() allowPowerups?: boolean;
  @IsOptional() @IsBoolean() allowPromocodes?: boolean;
  @IsOptional() @IsBoolean() allowStreakRewards?: boolean;
  @IsOptional() @IsBoolean() isMaintenanceMode?: boolean;
  @IsOptional() @IsString()  maintenanceMessage?: string;
}

export class CreatePromocodeDto {
  @IsString() code: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() discountPercent?: number;
  @IsOptional() @IsNumber() flatOff?: number;
  @IsOptional() @IsNumber() maxDiscount?: number;
  @IsOptional() @IsNumber() minEntryFee?: number;
  @IsOptional() @IsNumber() maxUsesTotal?: number;
  @IsOptional() @IsNumber() maxUsesPerUser?: number;
  @IsOptional() @IsArray()  allowedMatches?: number[];
  @IsOptional() @IsArray()  allowedContestTypes?: string[];
  @IsOptional() @IsArray()  userSegment?: number[];
  @IsOptional() validFrom?: string;
  @IsOptional() validTo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() firstTimeUserOnly?: boolean;
}

export class CreateContestTemplateDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() type: string;
  @IsNumber() entryFee: number;
  @IsNumber() totalPrize: number;
  @IsNumber() maxSpots: number;
  @IsOptional() @IsNumber()  multiEntry?: number;
  @IsOptional() @IsBoolean() isGuaranteed?: boolean;
  @IsOptional() @IsArray()   prizeBreakdown?: Array<{ rankFrom: number; rankTo: number; prize: number; percentOfPool?: number }>;
  @IsOptional() @IsArray()   autoFormats?: string[];
  @IsOptional() @IsBoolean() autoAttach?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString()  icon?: string;
  @IsOptional() @IsString()  accent?: string;
}

export class BulkAttachTemplatesDto {
  @IsNumber() matchId: number;
  @IsArray()  templateIds: string[];
}

export class SettleContestDto {
  @IsString() contestId: string;

  @IsOptional() @IsBoolean() forceResettle?: boolean;

  @IsOptional() @IsString() note?: string;
}

export class RefundContestDto {
  @IsString() contestId: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() cancelContest?: boolean;
}

export class OverridePlayerCreditDto {
  @IsNumber() matchId: number;
  @IsNumber() playerId: number;
  @IsNumber() newCredit: number;
  @IsOptional() @IsString() reason?: string;
}

export class ManualPointsDto {
  @IsNumber() matchId: number;
  @IsNumber() playerId: number;
  @IsNumber() points: number;
  @IsOptional() @IsString() reason?: string;
}

export class BroadcastNotificationDto {
  @IsString() title: string;
  @IsString() body: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() matchId?: number;
  @IsOptional() @IsString() contestId?: string;
  @IsOptional() @IsArray()  userIds?: number[];
  @IsOptional() @IsString() link?: string;
}

export class UpsertBonusRuleDto {
  @IsString() trigger: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() maxPayout?: number;
  @IsOptional() @IsNumber() minSpend?: number;
  @IsOptional() @IsNumber() wageringMultiplier?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class GrantPowerupDto {
  @IsOptional() @IsNumber() userId?: number;
  @IsOptional() @IsArray()  userIds?: number[];
  @IsString() type: string;
  @IsNumber() count: number;
  @IsOptional() @IsString() source?: string;
}

export class UpdateStreakScheduleDto {
  @IsArray() schedule: Array<{ day: number; amount: number; type?: string; powerupType?: string }>;
}
