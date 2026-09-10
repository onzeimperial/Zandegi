import { formatDistanceToNowStrict } from "date-fns";
import { AvatarRender } from "@/components/avatar/avatar-render";
import type { CrewMember } from "@/server/crew/service";

export function CrewMemberRow({ member }: { member: CrewMember }) {
  return (
    <div className="flex items-center gap-3 border-b border-game-surface-hi py-3 last:border-0">
      <AvatarRender config={member.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-game-body text-sm font-semibold">{member.name}</span>
          {member.level != null ? (
            <span className="shrink-0 font-game-body text-[11px] text-game-text-dim">Lv {member.level}</span>
          ) : null}
        </div>
        <p className="truncate font-game-body text-xs text-game-text-dim">
          {member.currentMission ?? "Working on something private"}
        </p>
      </div>
      <span className="shrink-0 font-game-body text-[11px] text-game-text-dim">
        {member.lastActiveAt
          ? `${formatDistanceToNowStrict(new Date(member.lastActiveAt))} ago`
          : "no activity yet"}
      </span>
    </div>
  );
}
