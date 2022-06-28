import type { Model } from "./Base.ts";
import type { Snowflake } from "../util/Snowflake.ts";
import type { Session } from "../session/Session.ts";
import type { DiscordEmoji, DiscordGuild, DiscordInviteMetadata, DiscordRole } from "../vendor/external.ts";
import type { GetInvite } from "../util/Routes.ts";
import {
    DefaultMessageNotificationLevels,
    ExplicitContentFilterLevels,
    VerificationLevels,
} from "../vendor/external.ts";
import { iconBigintToHash, iconHashToBigInt } from "../util/hash.ts";
import { urlToBase64 } from "../util/urlToBase64.ts";
import Member from "./Member.ts";
import BaseGuild from "./BaseGuild.ts";
import Role from "./Role.ts";
import GuildEmoji from "./GuildEmoji.ts";
import Invite from "./Invite.ts";
import * as Routes from "../util/Routes.ts";

export interface CreateRole {
    name?: string;
    color?: number;
    iconHash?: string | bigint;
    unicodeEmoji?: string;
    hoist?: boolean;
    mentionable?: boolean;
}

export interface CreateGuildEmoji {
    name: string;
    image: string;
    roles?: Snowflake[];
    reason?: string;
}

export interface ModifyGuildEmoji {
    name?: string;
    roles?: Snowflake[];
}

/**
 * Represents a guild
 * @link https://discord.com/developers/docs/resources/guild#guild-object
 */
export class Guild extends BaseGuild implements Model {
    constructor(session: Session, data: DiscordGuild) {
        super(session, data);

        this.splashHash = data.splash ? iconHashToBigInt(data.splash) : undefined;
        this.discoverySplashHash = data.discovery_splash ? iconHashToBigInt(data.discovery_splash) : undefined;
        this.ownerId = data.owner_id;
        this.widgetEnabled = !!data.widget_enabled;
        this.widgetChannelId = data.widget_channel_id ? data.widget_channel_id : undefined;
        this.vefificationLevel = data.verification_level;
        this.defaultMessageNotificationLevel = data.default_message_notifications;
        this.explicitContentFilterLevel = data.explicit_content_filter;
        this.members = data.members?.map((member) => new Member(session, { ...member, user: member.user! })) ?? [];
        this.roles = data.roles.map((role) => new Role(session, role, data.id));
        this.emojis = data.emojis.map((guildEmoji) => new GuildEmoji(session, guildEmoji, data.id));
    }

    splashHash?: bigint;
    discoverySplashHash?: bigint;
    ownerId: Snowflake;
    widgetEnabled: boolean;
    widgetChannelId?: Snowflake;
    vefificationLevel: VerificationLevels;
    defaultMessageNotificationLevel: DefaultMessageNotificationLevels;
    explicitContentFilterLevel: ExplicitContentFilterLevels;
    members: Member[];
    roles: Role[];
    emojis: GuildEmoji[];

    async createEmoji(options: CreateGuildEmoji): Promise<GuildEmoji> {
        if (options.image && !options.image.startsWith("data:image/")) {
            options.image = await urlToBase64(options.image);
        }

        const emoji = await this.session.rest.runMethod<DiscordEmoji>(
            this.session.rest,
            "POST",
            Routes.GUILD_EMOJIS(this.id),
            options,
        );

        return new GuildEmoji(this.session, emoji, this.id);
    }

    async deleteEmoji(id: Snowflake, { reason }: { reason?: string } = {}): Promise<void> {
        await this.session.rest.runMethod<undefined>(
            this.session.rest,
            "DELETE",
            Routes.GUILD_EMOJI(this.id, id),
            { reason },
        );
    }

    async editEmoji(id: Snowflake, options: ModifyGuildEmoji): Promise<GuildEmoji> {
        const emoji = await this.session.rest.runMethod<DiscordEmoji>(
            this.session.rest,
            "PATCH",
            Routes.GUILD_EMOJI(this.id, id),
            options,
        );

        return new GuildEmoji(this.session, emoji, this.id);
    }

    async createRole(options: CreateRole): Promise<Role> {
        let icon: string | undefined;

        if (options.iconHash) {
            if (typeof options.iconHash === "string") {
                icon = options.iconHash;
            } else {
                icon = iconBigintToHash(options.iconHash);
            }
        }

        const role = await this.session.rest.runMethod<DiscordRole>(
            this.session.rest,
            "PUT",
            Routes.GUILD_ROLES(this.id),
            {
                name: options.name,
                color: options.color,
                icon,
                unicode_emoji: options.unicodeEmoji,
                hoist: options.hoist,
                mentionable: options.mentionable,
            },
        );

        return new Role(this.session, role, this.id);
    }

    async deleteRole(roleId: Snowflake): Promise<void> {
        await this.session.rest.runMethod<undefined>(this.session.rest, "DELETE", Routes.GUILD_ROLE(this.id, roleId));
    }

    // TODO: edit role

    async deleteInvite(inviteCode: string): Promise<void> {
        await this.session.rest.runMethod<undefined>(
            this.session.rest,
            "DELETE",
            Routes.INVITE(inviteCode),
            {},
        );
    }

    async fetchInvite(inviteCode: string, options: GetInvite): Promise<Invite> {
        const inviteMetadata = await this.session.rest.runMethod<DiscordInviteMetadata>(
            this.session.rest,
            "GET",
            Routes.INVITE(inviteCode, options),
        );

        return new Invite(this.session, inviteMetadata);
    }
}

export default Guild;
