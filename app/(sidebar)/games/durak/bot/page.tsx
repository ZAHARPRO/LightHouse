"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import DurakCard from "@/components/DurakCard";
import {
  type Card,
  type Suit,
  type TableSlot,
  type Variant,
  createDeck,
  dealCards,
  findFirstAttacker,
  canAttack,
  canDefend,
  canTransfer,
  isFullyDefended,
  maxAttackCards,
  replenishHands,
  checkWinCondition,
  nextActive,
  cardsEqual,
  SUIT_SYMBOL,
} from "@/lib/durak";
import {
  type BotDifficulty,
  type ClientBotState,
  getBotAction,
  getBotDelay,
} from "@/lib/durak-bot";
import { awardGameBadge } from "@/actions/badges";

// ── Types ────────────────────────────────────────────────────────────────────

interface BotGameState {
  deck: Card[];
  trumpCard: Card | null;
  trumpSuit: Suit;
  hands: Card[][];
  tableSlots: TableSlot[];
  discardCount: number;
  phase: "attack" | "defense" | "throwing" | "finished";
  attackerIdx: number;
  defenderIdx: number;
  outPlayers: Set<number>;
  durak: number | null;
  log: string[];
  animating: boolean;
}

const PLAYER_IDX = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

function initGame(
  deckSize: 36 | 52,
  playerCount: number,
): BotGameState {
  const deck = createDeck(deckSize);
  const { hands, remaining } = dealCards(deck, playerCount);
  const trumpCard = remaining[remaining.length - 1] ?? null;
  const trumpSuit: Suit = trumpCard?.suit ?? "S";
  const attackerIdx = findFirstAttacker(hands, trumpSuit);
  const defenderIdx = nextActive(attackerIdx, playerCount, new Set());
  return {
    deck: remaining,
    trumpCard,
    trumpSuit,
    hands,
    tableSlots: [],
    discardCount: 0,
    phase: "attack",
    attackerIdx,
    defenderIdx,
    outPlayers: new Set(),
    durak: null,
    log: [],
    animating: false,
  };
}

function removeFromHand(hand: Card[], card: Card): Card[] {
  const idx = hand.findIndex((c) => cardsEqual(c, card));
  if (idx < 0) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

function resolveBout(
  state: BotGameState,
  defenderTook: boolean,
  playerCount: number,
): BotGameState {
  const newHands = state.hands.map((h) => [...h]);
  let discardCount = state.discardCount;

  if (defenderTook) {
    const picked: Card[] = [];
    for (const slot of state.tableSlots) {
      picked.push(slot.attack);
      if (slot.defense) picked.push(slot.defense);
    }
    newHands[state.defenderIdx].push(...picked);
  } else {
    for (const slot of state.tableSlots) {
      discardCount += slot.defense ? 2 : 1;
    }
  }

  const { hands, deck } = replenishHands(
    newHands,
    state.deck,
    state.attackerIdx,
    state.defenderIdx,
    state.outPlayers,
  );

  const newOut = new Set(state.outPlayers);
  if (deck.length === 0) {
    for (let p = 0; p < playerCount; p++) {
      if (!newOut.has(p) && hands[p].length === 0) newOut.add(p);
    }
  }

  const { durak, gameOver } = checkWinCondition(hands, deck, newOut);

  if (gameOver) {
    return {
      ...state,
      deck,
      hands,
      discardCount,
      tableSlots: [],
      outPlayers: newOut,
      phase: "finished",
      durak: durak ?? null,
      animating: false,
    };
  }

  const newAttacker = defenderTook
    ? nextActive(state.defenderIdx, playerCount, newOut)
    : newOut.has(state.defenderIdx)
      ? nextActive(state.defenderIdx, playerCount, newOut)
      : state.defenderIdx;

  const newDefender = nextActive(newAttacker, playerCount, newOut);

  return {
    ...state,
    deck,
    hands,
    discardCount,
    tableSlots: [],
    outPlayers: newOut,
    phase: "attack",
    attackerIdx: newAttacker,
    defenderIdx: newDefender,
    animating: false,
  };
}

// ── Bot name helper ──────────────────────────────────────────────────────────

function botName(idx: number): string {
  return `Bot ${idx}`;
}

// ── Inner page (reads searchParams) ─────────────────────────────────────────

function DurakBotGame() {
  const t = useTranslations("durak");
  const router = useRouter();
  const searchParams = useSearchParams();

  const difficulty = (searchParams.get("difficulty") ?? "medium") as BotDifficulty;
  const deckSize = (Number(searchParams.get("deck") ?? "36") === 52 ? 52 : 36) as 36 | 52;
  const variant = (searchParams.get("variant") ?? "podkidnoy") as Variant;
  const playerCount = Math.min(6, Math.max(2, Number(searchParams.get("players") ?? "2")));

  const [game, setGame] = useState<BotGameState>(() =>
    initGame(deckSize, playerCount),
  );

  // For defense: which attack slot the player has selected to cover
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  // Brief "invalid move" shake on a card
  const [shakeCardKey, setShakeCardKey] = useState<string | null>(null);
  // Drag-and-drop
  const [dragCard, setDragCard] = useState<Card | null>(null);
  // Slot highlighted by drag-over
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Log ref to auto-scroll
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [game.log]);

  // Award badge when player wins vs bot
  useEffect(() => {
    if (game.phase === "finished" && game.durak !== null && game.durak !== PLAYER_IDX) {
      awardGameBadge("DURAK_WIN").catch(() => {});
    }
  }, [game.phase, game.durak]);

  // ── Apply log helper ────────────────────────────────────────────────────────

  const addLog = (msg: string) => {
    setGame((prev) => ({
      ...prev,
      log: [...prev.log.slice(-30), msg],
    }));
  };

  // ── Bot turn driver ─────────────────────────────────────────────────────────

  const triggerBotTurn = useCallback(
    (stateSnapshot: BotGameState) => {
      const { phase, attackerIdx, defenderIdx, outPlayers, hands, tableSlots, trumpSuit, deck } = stateSnapshot;

      const isPlayerTurn =
        !stateSnapshot.animating &&
        phase !== "finished" &&
        ((phase === "attack" && attackerIdx === PLAYER_IDX) ||
          (phase === "defense" && defenderIdx === PLAYER_IDX) ||
          (phase === "throwing" && attackerIdx === PLAYER_IDX));

      if (isPlayerTurn || stateSnapshot.animating || phase === "finished") return;

      // Find which bot should act
      let actingBot = -1;
      if (phase === "attack" && attackerIdx !== PLAYER_IDX) {
        actingBot = attackerIdx;
      } else if (phase === "defense" && defenderIdx !== PLAYER_IDX) {
        actingBot = defenderIdx;
      } else if (phase === "throwing") {
        // In throwing phase, non-defender bots can throw
        for (let p = 1; p < playerCount; p++) {
          if (!outPlayers.has(p) && p !== defenderIdx) {
            actingBot = p;
            break;
          }
        }
      }

      if (actingBot < 0) return;

      // Build ClientBotState
      const opponentCardCounts = Array.from({ length: playerCount - 1 }, (_, i) => {
        const oppIdx = (actingBot + i + 1) % playerCount;
        return hands[oppIdx]?.length ?? 0;
      });

      const botState: ClientBotState = {
        hand: hands[actingBot],
        tableSlots,
        deckCount: deck.length,
        trumpSuit,
        opponentCardCounts,
        phase,
        attackerIdx,
        defenderIdx,
        myIdx: actingBot,
        variant,
      };

      setGame((prev) => ({ ...prev, animating: true }));

      const delay = getBotDelay(difficulty);
      setTimeout(() => {
        const botAction = getBotAction(botState, difficulty);

        setGame((prev) => {
          if (prev.phase === "finished") return prev;

          const newHands = prev.hands.map((h) => [...h]);
          let newSlots = [...prev.tableSlots];
          let newPhase = prev.phase;
          let newAttackerIdx = prev.attackerIdx;
          let newDefenderIdx = prev.defenderIdx;
          let logMsg = "";

          switch (botAction.action) {
            case "attack": {
              if (!canAttack(botAction.card, newSlots)) break;
              const defHand = newHands[prev.defenderIdx].length;
              const undefended = newSlots.filter((s) => !s.defense).length;
              if (newSlots.length >= 6 || undefended >= Math.min(6, defHand)) break;
              newHands[actingBot] = removeFromHand(newHands[actingBot], botAction.card);
              newSlots.push({ attack: botAction.card, defense: null });
              newPhase = "defense";
              logMsg = `${botName(actingBot)} attacks ${botAction.card.rank}${botAction.card.suit}`;
              break;
            }

            case "defend": {
              const slot = newSlots[botAction.slotIdx];
              if (!slot || slot.defense) break;
              if (!canDefend(slot.attack, botAction.card, prev.trumpSuit)) break;
              newHands[actingBot] = removeFromHand(newHands[actingBot], botAction.card);
              newSlots[botAction.slotIdx] = { ...slot, defense: botAction.card };
              logMsg = `${botName(actingBot)} defends with ${botAction.card.rank}${botAction.card.suit}`;
              // BUG FIX: if all attacks are now defended, switch to "attack" so
              // the player/bot attacker can throw more or pass.
              if (newSlots.every((s) => s.defense !== null)) newPhase = "attack";
              break;
            }

            case "throw": {
              if (!canAttack(botAction.card, newSlots)) break;
              const defHand = newHands[prev.defenderIdx].length;
              const undefended = newSlots.filter((s) => !s.defense).length;
              if (newSlots.length >= 6 || undefended >= Math.min(6, defHand)) break;
              newHands[actingBot] = removeFromHand(newHands[actingBot], botAction.card);
              newSlots.push({ attack: botAction.card, defense: null });
              newPhase = "defense";
              logMsg = `${botName(actingBot)} throws ${botAction.card.rank}${botAction.card.suit}`;
              break;
            }

            case "transfer": {
              const nextDef = nextActive(prev.defenderIdx, playerCount, prev.outPlayers);
              if (!canTransfer(botAction.card, newSlots, variant, newHands[nextDef].length)) break;
              newHands[actingBot] = removeFromHand(newHands[actingBot], botAction.card);
              newSlots.push({ attack: botAction.card, defense: null });
              newAttackerIdx = prev.defenderIdx;
              newDefenderIdx = nextDef;
              newPhase = "defense";
              logMsg = `${botName(actingBot)} transfers`;
              break;
            }

            case "take": {
              logMsg = `${botName(actingBot)} takes cards`;
              const next = resolveBout({ ...prev, hands: newHands }, true, playerCount);
              return { ...next, log: [...prev.log.slice(-30), logMsg] };
            }

            case "pass": {
              // If table is fully defended, resolve bout; else just pass (transition to throwing or attack)
              if (newSlots.length === 0) {
                // Nothing happened — shouldn't normally occur
                logMsg = `${botName(actingBot)} passes`;
                newPhase = "attack";
              } else if (isFullyDefended(newSlots)) {
                logMsg = `${botName(actingBot)} passes (done)`;
                const next = resolveBout({ ...prev, hands: newHands }, false, playerCount);
                return { ...next, log: [...prev.log.slice(-30), logMsg] };
              } else {
                logMsg = `${botName(actingBot)} passes`;
                newPhase = "attack";
              }
              break;
            }
          }

          return {
            ...prev,
            hands: newHands,
            tableSlots: newSlots,
            phase: newPhase,
            attackerIdx: newAttackerIdx,
            defenderIdx: newDefenderIdx,
            animating: false,
            log: logMsg ? [...prev.log.slice(-30), logMsg] : prev.log,
          };
        });
      }, delay);
    },
    [difficulty, variant, playerCount],
  );

  // Watch for bot turn triggers
  useEffect(() => {
    if (game.animating || game.phase === "finished") return;

    const isPlayerAttackTurn =
      game.phase === "attack" && game.attackerIdx === PLAYER_IDX;
    const isPlayerDefendTurn =
      game.phase === "defense" && game.defenderIdx === PLAYER_IDX;
    const isPlayerThrowTurn =
      game.phase === "throwing" && game.attackerIdx === PLAYER_IDX;

    if (!isPlayerAttackTurn && !isPlayerDefendTurn && !isPlayerThrowTurn) {
      // Small delay to debounce re-triggers
      const id = setTimeout(() => triggerBotTurn(game), 80);
      return () => clearTimeout(id);
    }
  }, [game, triggerBotTurn]);

  // ── Player actions ──────────────────────────────────────────────────────────

  function shakeCard(key: string) {
    setShakeCardKey(key);
    setTimeout(() => setShakeCardKey(null), 500);
  }

  // Shared defense logic used by both click and drag-drop paths
  function performDefend(card: Card, slotIdx: number) {
    const { defenderIdx, tableSlots, trumpSuit, hands } = game;
    const cardKey = `${card.suit}-${card.rank}`;
    const slot = tableSlots[slotIdx];
    if (!slot || slot.defense) { shakeCard(cardKey); setSelectedSlotIdx(null); return; }
    if (!canDefend(slot.attack, card, trumpSuit)) { shakeCard(cardKey); return; }

    // Transfer (переводной)
    if (variant === "perevodnoy") {
      const nextDef = nextActive(defenderIdx, playerCount, game.outPlayers);
      if (canTransfer(card, tableSlots, variant, hands[nextDef]?.length ?? 0)) {
        setGame((prev) => {
          const newHands = prev.hands.map((h) => [...h]);
          newHands[PLAYER_IDX] = removeFromHand(newHands[PLAYER_IDX], card);
          const newSlots = [...prev.tableSlots, { attack: card, defense: null }];
          return { ...prev, hands: newHands, tableSlots: newSlots, phase: "defense",
            attackerIdx: prev.defenderIdx, defenderIdx: nextDef,
            log: [...prev.log.slice(-30), `You transfer ${card.rank}${card.suit}`] };
        });
        setSelectedSlotIdx(null);
        return;
      }
    }

    setGame((prev) => {
      const newHands = prev.hands.map((h) => [...h]);
      newHands[PLAYER_IDX] = removeFromHand(newHands[PLAYER_IDX], card);
      const newSlots = prev.tableSlots.map((s, i) => i === slotIdx ? { ...s, defense: card } : s);
      const allDefended = newSlots.every((s) => s.defense !== null);
      return { ...prev, hands: newHands, tableSlots: newSlots,
        phase: allDefended ? "attack" : "defense",
        log: [...prev.log.slice(-30), `You defend with ${card.rank}${card.suit}`] };
    });
    setSelectedSlotIdx(null);
  }

  function handlePlayerCardClick(card: Card) {
    const cardKey = `${card.suit}-${card.rank}`;
    if (game.animating || game.phase === "finished") return;

    const { phase, attackerIdx, defenderIdx, tableSlots, trumpSuit, hands } = game;

    // Attack phase
    if (phase === "attack" && attackerIdx === PLAYER_IDX) {
      if (!canAttack(card, tableSlots)) {
        shakeCard(cardKey);
        return;
      }
      const defHand = hands[defenderIdx].length;
      const undefended = tableSlots.filter((s) => !s.defense).length;
      if (tableSlots.length >= 6 || undefended >= Math.min(6, defHand)) {
        shakeCard(cardKey);
        return;
      }
      setGame((prev) => {
        const newHands = prev.hands.map((h) => [...h]);
        newHands[PLAYER_IDX] = removeFromHand(newHands[PLAYER_IDX], card);
        const newSlots = [...prev.tableSlots, { attack: card, defense: null }];
        return {
          ...prev,
          hands: newHands,
          tableSlots: newSlots,
          phase: "defense",
          log: [...prev.log.slice(-30), `You attack ${card.rank}${card.suit}`],
        };
      });
      setSelectedSlotIdx(null);
      return;
    }

    // Defense phase — player is defender
    if (phase === "defense" && defenderIdx === PLAYER_IDX) {
      if (selectedSlotIdx === null) {
        shakeCard(cardKey);
        return;
      }
      performDefend(card, selectedSlotIdx);
      return;
    }

    // Throwing phase — player is non-defender attacker (подкидной)
    if (phase === "throwing" && attackerIdx === PLAYER_IDX) {
      if (!canAttack(card, tableSlots)) {
        shakeCard(cardKey);
        return;
      }
      const defHand = hands[defenderIdx].length;
      const undefended = tableSlots.filter((s) => !s.defense).length;
      if (tableSlots.length >= 6 || undefended >= Math.min(6, defHand)) {
        shakeCard(cardKey);
        return;
      }
      setGame((prev) => {
        const newHands = prev.hands.map((h) => [...h]);
        newHands[PLAYER_IDX] = removeFromHand(newHands[PLAYER_IDX], card);
        const newSlots = [...prev.tableSlots, { attack: card, defense: null }];
        return {
          ...prev,
          hands: newHands,
          tableSlots: newSlots,
          phase: "defense",
          log: [...prev.log.slice(-30), `You throw in ${card.rank}${card.suit}`],
        };
      });
      return;
    }

    shakeCard(cardKey);
  }

  function handleTableSlotClick(idx: number) {
    if (game.phase !== "defense" || game.defenderIdx !== PLAYER_IDX) return;
    const slot = game.tableSlots[idx];
    if (!slot || slot.defense) return;
    setSelectedSlotIdx((prev) => (prev === idx ? null : idx));
  }

  function handlePass() {
    if (game.animating || game.phase === "finished") return;
    const { phase, attackerIdx, tableSlots } = game;
    if (phase === "attack" && attackerIdx === PLAYER_IDX) {
      if (tableSlots.length === 0) return; // nothing to pass
      if (isFullyDefended(tableSlots)) {
        setGame((prev) => {
          const next = resolveBout(prev, false, playerCount);
          return { ...next, log: [...prev.log.slice(-30), "You pass (done)"] };
        });
      } else {
        // Move to throwing phase for the bot to optionally throw
        setGame((prev) => ({
          ...prev,
          phase: "throwing",
          log: [...prev.log.slice(-30), "You pass"],
        }));
      }
    }
    setSelectedSlotIdx(null);
  }

  function handleTake() {
    if (game.animating || game.phase === "finished") return;
    const { phase, defenderIdx, tableSlots } = game;
    if (phase !== "defense" || defenderIdx !== PLAYER_IDX) return;
    if (tableSlots.length === 0) return;
    setGame((prev) => {
      const next = resolveBout(prev, true, playerCount);
      return { ...next, log: [...prev.log.slice(-30), "You take cards"] };
    });
    setSelectedSlotIdx(null);
  }

  function handleRestart() {
    setGame(initGame(deckSize, playerCount));
    setSelectedSlotIdx(null);
    setShakeCardKey(null);
  }

  // ── Derived state for UI ────────────────────────────────────────────────────

  const playerHand = game.hands[PLAYER_IDX] ?? [];
  const isPlayerAttacker = game.attackerIdx === PLAYER_IDX;
  const isPlayerDefender = game.defenderIdx === PLAYER_IDX;
  const isPlayerTurn =
    !game.animating &&
    game.phase !== "finished" &&
    (isPlayerAttacker || isPlayerDefender);

  const canPlayerPass =
    !game.animating &&
    game.phase === "attack" &&
    isPlayerAttacker &&
    game.tableSlots.length > 0;

  const canPlayerTake =
    !game.animating &&
    game.phase === "defense" &&
    isPlayerDefender &&
    game.tableSlots.length > 0;

  const trumpSymbol = SUIT_SYMBOL[game.trumpSuit];
  const isRed = game.trumpSuit === "H" || game.trumpSuit === "D";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main
      className="flex flex-col"
      style={{ height: "calc(100vh - 64px)", background: "var(--bg-primary)" }}
    >
      {/* Game over overlay */}
      {game.phase === "finished" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 p-10 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl">
            <div className="text-6xl leading-none">
              {game.durak === PLAYER_IDX ? "😅" : "🏆"}
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-extrabold text-[var(--text-primary)] mb-1">
                {game.durak === PLAYER_IDX ? t("youAreDurak") : t("youWin")}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {game.durak !== null && game.durak !== PLAYER_IDX
                  ? `${botName(game.durak)} ${t("durakIs", { name: "" }).replace("{name} ", "").trim()}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                className="px-8 py-3 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold hover:opacity-90 transition-opacity"
              >
                {t("playAgain")}
              </button>
              <Link
                href="/games/durak"
                className="px-8 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-semibold hover:text-[var(--text-primary)] transition-colors"
              >
                ← {t("backToGames")}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
          <Link
            href="/games/durak"
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            ← {t("backToGames")}
          </Link>
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="font-mono">
              {t("deck")}: {game.deck.length}
            </span>
            <span className="font-mono">
              {t("discard")}: {game.discardCount}
            </span>
            <span
              className="font-bold text-sm"
              style={{ color: isRed ? "#dc2626" : "var(--text-primary)" }}
            >
              {trumpSymbol} {t("trump")}
            </span>
            {game.animating && (
              <span className="text-[var(--accent-orange)] animate-pulse font-semibold">
                {t("botThinking")}
              </span>
            )}
          </div>
          <button
            onClick={handleRestart}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-orange)] transition-colors"
          >
            ↺ {t("playAgain")}
          </button>
        </div>

        <div className="flex flex-1 min-h-0 gap-0">
          {/* Left sidebar: trump + log */}
          <div
            className="flex flex-col gap-3 p-3 border-r border-[var(--border-subtle)] shrink-0"
            style={{ width: 140 }}
          >
            {/* Trump card */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[0.65rem] text-[var(--text-muted)] font-semibold uppercase tracking-wide">
                {t("trump")}
              </p>
              {game.deck.length > 0 && game.trumpCard ? (
                <DurakCard card={game.trumpCard} size="sm" style={{ transform: "rotate(90deg)" }} />
              ) : (
                <div className="text-2xl leading-none">{trumpSymbol}</div>
              )}
              <span
                className="text-base font-bold"
                style={{ color: isRed ? "#dc2626" : "var(--text-primary)" }}
              >
                {trumpSymbol}
              </span>
            </div>

            {/* Phase indicator */}
            <div className="flex flex-col gap-1 text-[0.65rem]">
              <div
                className={[
                  "px-2 py-1 rounded text-center font-semibold",
                  isPlayerAttacker && !game.animating && game.phase === "attack"
                    ? "bg-[var(--accent-orange)]/15 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)]",
                ].join(" ")}
              >
                {isPlayerAttacker ? t("youAttack") : `Bot ${t("attacker")}`}
              </div>
              <div
                className={[
                  "px-2 py-1 rounded text-center font-semibold",
                  isPlayerDefender && !game.animating && game.phase === "defense"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)]",
                ].join(" ")}
              >
                {isPlayerDefender ? t("youDefend") : `Bot ${t("defender")}`}
              </div>
            </div>

            {/* Card counts */}
            <div className="flex flex-col gap-1 text-[0.65rem] text-[var(--text-muted)]">
              <p className="font-semibold">Hand sizes:</p>
              <p>You: {playerHand.length}</p>
              {Array.from({ length: playerCount - 1 }, (_, i) => (
                <p key={i}>Bot {i + 1}: {game.hands[i + 1]?.length ?? 0}</p>
              ))}
            </div>

            {/* Log */}
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <p className="text-[0.65rem] text-[var(--text-muted)] font-semibold uppercase tracking-wide">
                Log
              </p>
              <div
                ref={logRef}
                className="flex-1 overflow-y-auto flex flex-col gap-0.5 text-[0.6rem] text-[var(--text-muted)]"
              >
                {game.log.slice(-20).map((entry, i) => (
                  <p key={i} className="leading-tight">
                    {entry}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Main game area */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Bot hands area (top) — all bots in a row */}
            <div className="flex flex-wrap justify-center gap-4 py-3 px-4 shrink-0">
              {Array.from({ length: playerCount - 1 }, (_, idx) => {
                const botIdx = idx + 1;
                const botHand = game.hands[botIdx] ?? [];
                const count = botHand.length;
                const spread = Math.min(22, 180 / Math.max(1, count));
                return (
                  <div key={botIdx} className="flex flex-col items-center gap-1">
                    <p className="text-[0.65rem] font-semibold text-[var(--text-muted)]">
                      {botName(botIdx)}
                      {game.attackerIdx === botIdx && <span className="ml-1 text-[var(--accent-orange)]">[A]</span>}
                      {game.defenderIdx === botIdx && <span className="ml-1 text-blue-400">[D]</span>}
                      {game.outPlayers.has(botIdx) && <span className="ml-1 text-green-400">✓</span>}
                    </p>
                    <div style={{ position: "relative", height: 64, width: Math.max(48, count * 12 + 36) }}>
                      {botHand.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: 0,
                            transform: `translateX(calc(-50% + ${(i - (count - 1) / 2) * 12}px)) rotate(${(i - (count - 1) / 2) * spread}deg)`,
                            transformOrigin: "bottom center",
                          }}
                        >
                          <DurakCard faceDown size="sm" />
                        </div>
                      ))}
                      {count === 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-[0.6rem]">
                          {game.outPlayers.has(botIdx) ? "✓" : "—"}
                        </span>
                      )}
                    </div>
                    <span className="text-[0.6rem] text-[var(--text-muted)]">{count} 🂠</span>
                  </div>
                );
              })}
            </div>

            {/* Table area (center) — drop zone for attack/throw */}
            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-3 min-h-0"
              onDragOver={(e) => {
                const canDrop = dragCard && !game.animating && game.phase !== "finished" &&
                  ((game.phase === "attack" && game.attackerIdx === PLAYER_IDX) ||
                   (game.phase === "throwing" && game.attackerIdx === PLAYER_IDX));
                if (canDrop) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const c = JSON.parse(e.dataTransfer.getData("durak-card")) as Card;
                  handlePlayerCardClick(c);
                } catch { /* ignore */ }
                setDragCard(null);
              }}
            >
              {game.tableSlots.length === 0 && game.phase !== "finished" ? (
                <p className="text-[var(--text-muted)] text-sm italic">
                  {t("emptyTable")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center items-end">
                  {game.tableSlots.map((slot, idx) => {
                    const isSelected = selectedSlotIdx === idx;
                    const isDragOver = dragOverSlot === idx;
                    const isTargetable =
                      game.phase === "defense" &&
                      game.defenderIdx === PLAYER_IDX &&
                      !slot.defense &&
                      !game.animating;
                    return (
                      <div
                        key={idx}
                        className={[
                          "relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer",
                          isSelected || isDragOver
                            ? "bg-[var(--accent-orange)]/15 ring-2 ring-[var(--accent-orange)]"
                            : isTargetable
                              ? "bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)] ring-1 ring-[var(--border-subtle)]"
                              : "bg-[var(--bg-elevated)]",
                        ].join(" ")}
                        onClick={() => handleTableSlotClick(idx)}
                        onDragOver={(e) => {
                          if (isTargetable && dragCard) {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverSlot(idx);
                          }
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverSlot(null);
                          try {
                            const c = JSON.parse(e.dataTransfer.getData("durak-card")) as Card;
                            performDefend(c, idx);
                          } catch { /* ignore */ }
                          setDragCard(null);
                        }}
                      >
                        <DurakCard card={slot.attack} size="md" />
                        {slot.defense ? (
                          <div style={{ marginTop: -32 }}>
                            <DurakCard card={slot.defense} size="md" />
                          </div>
                        ) : (
                          <div style={{ height: 10 }} />
                        )}
                        {isTargetable && !isSelected && !isDragOver && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--accent-orange)] animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              {game.phase !== "finished" && (
                <div className="flex gap-2 mt-2">
                  {canPlayerPass && (
                    <button
                      onClick={handlePass}
                      className="px-5 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-semibold hover:text-[var(--text-primary)] transition-colors"
                    >
                      {t("pass")}
                    </button>
                  )}
                  {canPlayerTake && (
                    <button
                      onClick={handleTake}
                      className="px-5 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors"
                    >
                      {t("take")}
                    </button>
                  )}
                  {isPlayerDefender &&
                    game.phase === "defense" &&
                    selectedSlotIdx !== null && (
                      <p className="text-xs text-[var(--accent-orange)] self-center">
                        {t("defendHint")}
                      </p>
                    )}
                  {isPlayerDefender &&
                    game.phase === "defense" &&
                    selectedSlotIdx === null &&
                    game.tableSlots.some((s) => !s.defense) && (
                      <p className="text-xs text-[var(--text-muted)] self-center italic">
                        {t("defendHint")}
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* Player hand area (bottom) */}
            <div className="shrink-0 flex flex-col items-center gap-2 pb-4 px-4">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {t("yourHand")} ({playerHand.length})
                {isPlayerAttacker && !game.animating && (
                  <span className="ml-2 text-[var(--accent-orange)] text-[0.65rem]">
                    [{t("youAttack")}]
                  </span>
                )}
                {isPlayerDefender && !game.animating && (
                  <span className="ml-2 text-blue-400 text-[0.65rem]">
                    [{t("youDefend")}]
                  </span>
                )}
                {game.outPlayers.has(PLAYER_IDX) && (
                  <span className="ml-2 text-green-400 text-[0.65rem]">
                    [{t("done")}]
                  </span>
                )}
              </p>
              {/* Player hand fan */}
              <div
                style={{
                  position: "relative",
                  height: 140,
                  width: "100%",
                  maxWidth: 640,
                }}
              >
                {playerHand.map((card, i) => {
                  const count = playerHand.length;
                  const spread = Math.min(16, 180 / Math.max(1, count));
                  const angle = (i - (count - 1) / 2) * spread;
                  const offset = (i - (count - 1) / 2) * Math.min(28, 360 / Math.max(1, count));
                  const key = `${card.suit}-${card.rank}`;
                  const isShaking = shakeCardKey === key;

                  // Determine if card is playable
                  let isPlayable = false;
                  if (!game.animating && game.phase !== "finished") {
                    if (isPlayerAttacker && game.phase === "attack") {
                      isPlayable = canAttack(card, game.tableSlots);
                    } else if (isPlayerDefender && game.phase === "defense" && selectedSlotIdx !== null) {
                      const slot = game.tableSlots[selectedSlotIdx];
                      if (slot && !slot.defense) {
                        isPlayable = canDefend(slot.attack, card, game.trumpSuit);
                        if (!isPlayable && variant === "perevodnoy") {
                          const nextDef = nextActive(game.defenderIdx, playerCount, game.outPlayers);
                          isPlayable = canTransfer(card, game.tableSlots, variant, game.hands[nextDef]?.length ?? 0);
                        }
                      }
                    } else if (isPlayerDefender && game.phase === "defense") {
                      // card is playable if it can defend any undefended slot
                      isPlayable = game.tableSlots.some(
                        (s) => !s.defense && canDefend(s.attack, card, game.trumpSuit)
                      );
                    } else if (isPlayerAttacker && game.phase === "throwing") {
                      isPlayable = canAttack(card, game.tableSlots);
                    }
                  }

                  return (
                    <div
                      key={key}
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: 0,
                        transform: `translateX(calc(-50% + ${offset}px)) rotate(${angle}deg) ${isShaking ? "translateY(-6px)" : ""}`,
                        transformOrigin: "bottom center",
                        transition: isShaking ? "none" : "transform 0.15s ease",
                        zIndex: i,
                      }}
                      className={isShaking ? "animate-bounce" : ""}
                    >
                      <DurakCard
                        card={card}
                        size="lg"
                        onClick={() => handlePlayerCardClick(card)}
                        dimmed={!isPlayable && isPlayerTurn}
                        draggable={isPlayerTurn && !game.animating}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("durak-card", JSON.stringify(card));
                          setDragCard(card);
                          // If defending and no slot selected yet, highlight all valid slots
                          if (isPlayerDefender && game.phase === "defense") setSelectedSlotIdx(null);
                        }}
                        onDragEnd={() => setDragCard(null)}
                        className={[
                          "hover:-translate-y-4",
                          isPlayable && isPlayerTurn ? "ring-2 ring-[var(--accent-orange)]/60" : "",
                        ].join(" ")}
                      />
                    </div>
                  );
                })}
                {playerHand.length === 0 && game.phase !== "finished" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[var(--text-muted)] text-sm">
                      {game.outPlayers.has(PLAYER_IDX) ? "✓ " + t("done") : "No cards"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Export wrapped in Suspense for useSearchParams ───────────────────────────

export default function DurakBotPage() {
  return (
    <Suspense>
      <DurakBotGame />
    </Suspense>
  );
}
