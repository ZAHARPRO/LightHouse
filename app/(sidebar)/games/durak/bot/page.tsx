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
  type ThrowRule,
  createDeck,
  dealCards,
  findFirstAttacker,
  canAttack,
  canDefend,
  canTransfer,
  canThrowIn,
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

// Flying card during dealing animation
function FlyingCard({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const [arrived, setArrived] = useState(false);
  useEffect(() => { const f = requestAnimationFrame(() => setArrived(true)); return () => cancelAnimationFrame(f); }, []);
  const CARD_W = 52, CARD_H = 74;
  return (
    <div
      style={{
        position: "fixed",
        left: (arrived ? to.x : from.x) - CARD_W / 2,
        top:  (arrived ? to.y : from.y) - CARD_H / 2,
        transition: arrived ? "left 0.35s cubic-bezier(.2,1.3,.5,1), top 0.35s cubic-bezier(.2,1.3,.5,1), opacity 0.15s 0.3s" : "none",
        opacity: arrived ? 0 : 1,
        zIndex: 9999,
        pointerEvents: "none",
        transform: arrived ? "scale(0.7) rotate(8deg)" : "scale(1) rotate(0deg)",
      }}
    >
      <DurakCard faceDown size="sm" />
    </div>
  );
}

function DurakBotGame() {
  const t = useTranslations("durak");
  const router = useRouter();
  const searchParams = useSearchParams();

  const difficulty = (searchParams.get("difficulty") ?? "medium") as BotDifficulty;
  const deckSize = (Number(searchParams.get("deck") ?? "36") === 52 ? 52 : 36) as 36 | 52;
  const variant = (searchParams.get("variant") ?? "podkidnoy") as Variant;
  const playerCount = Math.min(6, Math.max(2, Number(searchParams.get("players") ?? "2")));
  const throwRule = (searchParams.get("throw") === "neighbors" ? "neighbors" : "all") as ThrowRule;

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
  // Dealing animation: counts up to playerCount*6 (one step per card dealt)
  const [gameKey, setGameKey] = useState(0);
  const [dealStep, setDealStep] = useState(0);
  const TOTAL_DEAL = playerCount * 6;

  // Log ref to auto-scroll
  const logRef        = useRef<HTMLDivElement>(null);
  // Refs for flying-card dealing animation
  const deckRef       = useRef<HTMLDivElement>(null);
  const playerHandRef = useRef<HTMLDivElement>(null);
  const botHandRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const tableRef      = useRef<HTMLDivElement>(null);
  const flyingIdRef   = useRef(0);
  const [flyingCards, setFlyingCards] = useState<{ id: number; from: {x:number;y:number}; to: {x:number;y:number} }[]>([]);
  // Last bot action label (shown briefly near bot hand)
  const [lastBotAction, setLastBotAction] = useState<{ botIdx: number; text: string } | null>(null);

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

  // Dealing animation — advance one step every 220ms, launching a flying card each step
  useEffect(() => {
    setDealStep(0);
    setFlyingCards([]);
    let step = 0;
    const id = setInterval(() => {
      step++;
      setDealStep(step);

      // Launch a flying card from the deck to the target player
      if (deckRef.current) {
        const deckRect = deckRef.current.getBoundingClientRect();
        const from = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };

        // Which player receives this card?
        const targetIdx = (step - 1) % playerCount; // 0 = human, 1+ = bots
        const toEl = targetIdx === PLAYER_IDX
          ? playerHandRef.current
          : botHandRefs.current[targetIdx - 1];
        const toRect = toEl?.getBoundingClientRect();
        const to = toRect
          ? { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 }
          : from;

        const fid = ++flyingIdRef.current;
        setFlyingCards(prev => [...prev, { id: fid, from, to }]);
        setTimeout(() => setFlyingCards(prev => prev.filter(c => c.id !== fid)), 450);
      }

      if (step >= TOTAL_DEAL) clearInterval(id);
    }, 220);
    return () => clearInterval(id);
  }, [gameKey, TOTAL_DEAL]); // eslint-disable-line react-hooks/exhaustive-deps

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
        for (let p = 1; p < playerCount; p++) {
          if (
            !outPlayers.has(p) &&
            p !== defenderIdx &&
            canThrowIn(p, attackerIdx, defenderIdx, playerCount, outPlayers, throwRule)
          ) {
            actingBot = p;
            break;
          }
        }
      }

      if (actingBot < 0) {
        // No eligible bot in throwing phase → auto-resolve the bout
        if (phase === "throwing") {
          setTimeout(() => setGame(prev => {
            if (prev.phase !== "throwing") return prev;
            const next = resolveBout(prev, false, playerCount);
            return { ...next, animating: false };
          }), 300);
        }
        return;
      }

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

        // Show bot action label near the bot's hand
        const SUIT_SYM: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
        const cardStr = botAction.action !== "take" && botAction.action !== "pass" && botAction.card
          ? ` ${botAction.card.rank}${SUIT_SYM[botAction.card.suit] ?? botAction.card.suit}`
          : "";
        const actionLabel: Record<string, string> = {
          attack: t("botAttacks"), defend: t("botDefends"), throw: t("botThrows"),
          transfer: t("botTransfers"), take: t("botTakes"), pass: t("botPasses"),
        };
        setLastBotAction({ botIdx: actingBot, text: `${actionLabel[botAction.action] ?? botAction.action}${cardStr}` });
        setTimeout(() => setLastBotAction(null), 1400);

        // Launch flying card animation: bot hand → table
        if (botAction.action !== "take" && botAction.action !== "pass") {
          const botEl = botHandRefs.current[actingBot - 1];
          const tableEl = tableRef.current;
          if (botEl && tableEl) {
            const fromRect = botEl.getBoundingClientRect();
            const toRect   = tableEl.getBoundingClientRect();
            const from = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
            const to   = { x: toRect.left  + toRect.width  / 2, y: toRect.top  + toRect.height  / 2 };
            const fid = ++flyingIdRef.current;
            setFlyingCards(prev => [...prev, { id: fid, from, to }]);
            setTimeout(() => setFlyingCards(prev => prev.filter(c => c.id !== fid)), 500);
          }
        }

        // Apply game state change, but keep animating=true for 700ms so player can see the card
        const POST_ACTION_PAUSE = 700;

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
              logMsg = `${botName(actingBot)} ${t("botAttacks")} ${botAction.card.rank}${botAction.card.suit}`;
              break;
            }
            case "defend": {
              const slot = newSlots[botAction.slotIdx];
              if (!slot || slot.defense) break;
              if (!canDefend(slot.attack, botAction.card, prev.trumpSuit)) break;
              newHands[actingBot] = removeFromHand(newHands[actingBot], botAction.card);
              newSlots[botAction.slotIdx] = { ...slot, defense: botAction.card };
              logMsg = `${botName(actingBot)} ${t("botDefends")} ${botAction.card.rank}${botAction.card.suit}`;
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
              logMsg = `${botName(actingBot)} ${t("botThrows")} ${botAction.card.rank}${botAction.card.suit}`;
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
              logMsg = `${botName(actingBot)} ${t("botTransfers")}`;
              break;
            }
            case "take": {
              logMsg = `${botName(actingBot)} ${t("botTakes")}`;
              const next = resolveBout({ ...prev, hands: newHands }, true, playerCount);
              // Keep animating for pause then release
              setTimeout(() => setGame(g => ({ ...g, animating: false })), POST_ACTION_PAUSE);
              return { ...next, animating: true, log: [...prev.log.slice(-30), logMsg] };
            }
            case "pass": {
              if (newSlots.length === 0) {
                logMsg = `${botName(actingBot)} ${t("botPasses")}`;
                newPhase = "attack";
              } else if (isFullyDefended(newSlots)) {
                logMsg = `${botName(actingBot)} ${t("botPasses")}`;
                const next = resolveBout({ ...prev, hands: newHands }, false, playerCount);
                setTimeout(() => setGame(g => ({ ...g, animating: false })), POST_ACTION_PAUSE);
                return { ...next, animating: true, log: [...prev.log.slice(-30), logMsg] };
              } else {
                logMsg = `${botName(actingBot)} ${t("botPasses")}`;
                newPhase = "attack";
              }
              break;
            }
          }

          // Schedule end of animating pause
          setTimeout(() => setGame(g => ({ ...g, animating: false })), POST_ACTION_PAUSE);

          return {
            ...prev,
            hands: newHands,
            tableSlots: newSlots,
            phase: newPhase,
            attackerIdx: newAttackerIdx,
            defenderIdx: newDefenderIdx,
            animating: true, // stays true until POST_ACTION_PAUSE expires
            log: logMsg ? [...prev.log.slice(-30), logMsg] : prev.log,
          };
        });
      }, delay);
    },
    [difficulty, variant, playerCount, throwRule], // eslint-disable-line react-hooks/exhaustive-deps
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

  // Apply a card transfer (переводной) — does NOT require a selected slot
  function applyTransfer(card: Card) {
    const { defenderIdx } = game;
    const nextDef = nextActive(defenderIdx, playerCount, game.outPlayers);
    setGame((prev) => {
      const newHands = prev.hands.map((h) => [...h]);
      newHands[PLAYER_IDX] = removeFromHand(newHands[PLAYER_IDX], card);
      const newSlots = [...prev.tableSlots, { attack: card, defense: null }];
      return { ...prev, hands: newHands, tableSlots: newSlots, phase: "defense",
        attackerIdx: prev.defenderIdx, defenderIdx: nextDef,
        log: [...prev.log.slice(-30), `${t("logYouTransfer")} ${card.rank}${card.suit}`] };
    });
    setSelectedSlotIdx(null);
  }

  // Defend a specific table slot with a card (no transfer logic — handled separately)
  function performDefend(card: Card, slotIdx: number) {
    const { tableSlots, trumpSuit } = game;
    const cardKey = `${card.suit}-${card.rank}`;
    const slot = tableSlots[slotIdx];
    if (!slot || slot.defense) { shakeCard(cardKey); setSelectedSlotIdx(null); return; }
    if (!canDefend(slot.attack, card, trumpSuit)) { shakeCard(cardKey); return; }

    setGame((prev) => {
      const newHands = prev.hands.map((h) => [...h]);
      newHands[PLAYER_IDX] = removeFromHand(newHands[PLAYER_IDX], card);
      const newSlots = prev.tableSlots.map((s, i) => i === slotIdx ? { ...s, defense: card } : s);
      const allDefended = newSlots.every((s) => s.defense !== null);
      return { ...prev, hands: newHands, tableSlots: newSlots,
        phase: allDefended ? "attack" : "defense",
        log: [...prev.log.slice(-30), `${t("logYouDefend")} ${card.rank}${card.suit}`] };
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
          log: [...prev.log.slice(-30), `${t("logYouAttack")} ${card.rank}${card.suit}`],
        };
      });
      setSelectedSlotIdx(null);
      return;
    }

    // Defense phase — player is defender
    if (phase === "defense" && defenderIdx === PLAYER_IDX) {
      // Check переводной transfer FIRST (no slot needed — card rank must match all attacks)
      if (variant === "perevodnoy") {
        const nextDef = nextActive(defenderIdx, playerCount, game.outPlayers);
        if (canTransfer(card, tableSlots, variant, hands[nextDef]?.length ?? 0)) {
          applyTransfer(card);
          return;
        }
      }
      // Regular defense requires a selected slot
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
          log: [...prev.log.slice(-30), `${t("logYouThrow")} ${card.rank}${card.suit}`],
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
          return { ...next, log: [...prev.log.slice(-30), t("logYouPassDone")] };
        });
      } else {
        // Move to throwing phase for the bot to optionally throw
        setGame((prev) => ({
          ...prev,
          phase: "throwing",
          log: [...prev.log.slice(-30), t("logYouPass")],
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
      return { ...next, log: [...prev.log.slice(-30), t("logYouTake")] };
    });
    setSelectedSlotIdx(null);
  }

  function handleRestart() {
    setGame(initGame(deckSize, playerCount));
    setSelectedSlotIdx(null);
    setShakeCardKey(null);
    setGameKey(k => k + 1);
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

  const isDealDone = dealStep >= TOTAL_DEAL;
  // Deal sequence idx for card c of player p: p gets card in round-robin order
  // Step k → player k % N gets their (k / N)-th card
  function dealIdx(p: number, c: number) { return c * playerCount + p; }

  return (
    <>
    <style>{`
      @keyframes durak-deal {
        from { transform: translateY(-48px) rotate(-6deg) scale(0.85); opacity: 0; }
        to   { transform: translateY(0px)  rotate(0deg)  scale(1);    opacity: 1; }
      }
      .durak-card-in {
        animation: durak-deal 0.22s cubic-bezier(0.34,1.3,0.64,1) both;
      }
    `}</style>
    <main
      className="flex flex-col"
      style={{ height: "calc(100vh - 64px)", background: "var(--bg-primary)" }}
    >
      {/* Flying cards during deal animation — rendered as fixed portal elements */}
      {flyingCards.map(fc => (
        <FlyingCard key={fc.id} from={fc.from} to={fc.to} />
      ))}

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
          <div className="flex items-center gap-3 text-xs">
            <span className={[
              "font-mono font-bold px-2 py-0.5 rounded-md",
              game.deck.length === 0   ? "text-[var(--text-muted)] bg-[var(--bg-secondary)]"
              : game.deck.length < 6   ? "text-red-400 bg-red-500/10"
              : game.deck.length < 16  ? "text-yellow-400 bg-yellow-500/10"
              :                          "text-emerald-400 bg-emerald-500/10"
            ].join(" ")}>
              🂠 {game.deck.length}
            </span>
            <span className="font-mono text-[var(--text-muted)]">
              ✕ {game.discardCount}
            </span>
            <span
              className="font-bold text-sm"
              style={{ color: isRed ? "#dc2626" : "var(--text-primary)" }}
            >
              {trumpSymbol} {t("trump")}
            </span>
            {!isDealDone && (
              <span className="text-indigo-400 animate-pulse font-semibold">
                {t("dealing")}
              </span>
            )}
            {game.animating && isDealDone && (
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
            {/* Deck stack with count badge + trump */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative" ref={deckRef} style={{ width: 52, height: 74 }}>
                {game.deck.length > 0 ? (
                  <>
                    {/* Trump card peeking sideways under deck */}
                    {game.trumpCard && (
                      <div style={{ position: "absolute", left: -16, top: "50%", transform: "translateY(-50%) rotate(90deg)", zIndex: 0, opacity: 0.9 }}>
                        <DurakCard card={game.trumpCard} size="sm" />
                      </div>
                    )}
                    <DurakCard faceDown size="sm" style={{ position: "relative", zIndex: 1 }} />
                    {/* Count badge */}
                    <div className={[
                      "absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.65rem] font-extrabold border-2 border-[var(--bg-primary)] z-10",
                      game.deck.length < 6  ? "bg-red-500 text-white"
                      : game.deck.length < 16 ? "bg-yellow-400 text-black"
                      :                         "bg-emerald-500 text-white"
                    ].join(" ")}>
                      {game.deck.length}
                    </div>
                  </>
                ) : (
                  <div className="w-[52px] h-[74px] rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center opacity-30 text-xl">🂠</div>
                )}
              </div>
              <span className="text-sm font-bold" style={{ color: isRed ? "#dc2626" : "var(--text-primary)" }}>
                {trumpSymbol} {t("trump")}
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

            {/* Card counts — hidden during deal animation */}
            {isDealDone && (
              <div className="flex flex-col gap-1 text-[0.65rem] text-[var(--text-muted)]">
                <p className="font-semibold">{t("handSizes")}:</p>
                <p>{t("you")}: {playerHand.length}</p>
                {Array.from({ length: playerCount - 1 }, (_, i) => (
                  <p key={i}>Bot {i + 1}: {game.hands[i + 1]?.length ?? 0}</p>
                ))}
              </div>
            )}

            {/* Log */}
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <p className="text-[0.65rem] text-[var(--text-muted)] font-semibold uppercase tracking-wide">
                {t("log")}
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
                  <div key={botIdx} className="flex flex-col items-center gap-1" ref={el => { botHandRefs.current[idx] = el; }}>
                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-[0.65rem] font-semibold text-[var(--text-muted)]">
                        {botName(botIdx)}
                        {game.attackerIdx === botIdx && <span className="ml-1 text-[var(--accent-orange)]">[A]</span>}
                        {game.defenderIdx === botIdx && <span className="ml-1 text-blue-400">[D]</span>}
                        {game.outPlayers.has(botIdx) && <span className="ml-1 text-green-400">✓</span>}
                      </p>
                      {/* Bot action label — shown after playing a card */}
                      {lastBotAction?.botIdx === botIdx && (
                        <span className="text-[0.6rem] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-md animate-pulse">
                          {lastBotAction.text}
                        </span>
                      )}
                    </div>
                    <div style={{ position: "relative", height: 64, width: Math.max(48, count * 12 + 36) }}>
                      {botHand.map((_, i) => {
                        const di = dealIdx(botIdx, i);
                        const visible = dealStep > di;
                        return (
                          <div
                            key={i}
                            className={visible ? "durak-card-in" : ""}
                            style={{
                              position: "absolute",
                              left: "50%",
                              bottom: 0,
                              transform: `translateX(calc(-50% + ${(i - (count - 1) / 2) * 12}px)) rotate(${(i - (count - 1) / 2) * spread}deg)`,
                              transformOrigin: "bottom center",
                              opacity: visible ? 1 : 0,
                              animationDelay: `0ms`,
                            }}
                          >
                            <DurakCard faceDown size="sm" />
                          </div>
                        );
                      })}
                      {count === 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-[0.6rem]">
                          {game.outPlayers.has(botIdx) ? "✓" : "—"}
                        </span>
                      )}
                    </div>
                    {isDealDone ? (
                      <span className={[
                        "font-mono font-bold text-xs px-1.5 py-0.5 rounded",
                        count === 0  ? "text-green-400 bg-green-500/10"
                        : count <= 3 ? "text-yellow-400 bg-yellow-500/10"
                        : count >= 10? "text-red-400 bg-red-500/10"
                        :              "text-[var(--text-muted)]"
                      ].join(" ")}>🂠 {count}</span>
                    ) : (
                      <span className="font-mono text-xs text-[var(--text-muted)] opacity-50">🂠 ?</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Table area (center) — drop zone for attack/throw */}
            <div
              ref={tableRef}
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
                            // Try transfer first, then regular defend
                            if (variant === "perevodnoy") {
                              const nextDef = nextActive(game.defenderIdx, playerCount, game.outPlayers);
                              if (canTransfer(c, game.tableSlots, variant, game.hands[nextDef]?.length ?? 0)) {
                                applyTransfer(c); setDragCard(null); return;
                              }
                            }
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

              {/* Action buttons + hint */}
              {game.phase !== "finished" && !game.animating && (
                <div className="flex flex-col gap-2 mt-2 w-full items-center">
                  {/* Contextual hint bar */}
                  {(() => {
                    if (isPlayerAttacker && game.phase === "attack" && game.tableSlots.length === 0)
                      return <p className="text-sm font-bold text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/30 px-4 py-2 rounded-xl text-center">🗡 {t("youAttackHint")}</p>;
                    if (isPlayerAttacker && game.phase === "attack" && game.tableSlots.length > 0)
                      return <p className="text-sm font-bold text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/30 px-4 py-2 rounded-xl text-center">🗡 {t("youAttackMoreHint")}</p>;
                    if (isPlayerDefender && game.phase === "defense" && selectedSlotIdx === null)
                      return <p className="text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-xl text-center">🛡 {t("defendHint")}</p>;
                    if (isPlayerDefender && game.phase === "defense" && selectedSlotIdx !== null)
                      return <p className="text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-xl text-center">🛡 {t("defendHint")}</p>;
                    return null;
                  })()}

                  <div className="flex gap-2">
                    {canPlayerPass && (
                      <button
                        onClick={handlePass}
                        className="px-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-semibold hover:text-[var(--text-primary)] transition-colors"
                      >
                        {t("pass")}
                      </button>
                    )}
                    {canPlayerTake && (
                      <button
                        onClick={handleTake}
                        className="px-6 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/25 transition-colors"
                      >
                        😮 {t("take")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Player hand area (bottom) */}
            <div ref={playerHandRef} className="shrink-0 flex flex-col items-center gap-2 pb-4 px-4">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {t("yourHand")} ({isDealDone ? playerHand.length : "?"})
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
              {/* Player hand — fan for ≤8, scrollable strip for >8 */}
              {playerHand.length > 8 ? (
                <div style={{ overflowX: "auto", width: "100%", maxWidth: 680, paddingBottom: 8, paddingTop: 4 }}>
                  <div style={{ display: "flex", gap: 4, padding: "0 8px", width: "max-content" }}>
                    {playerHand.map((card, i) => {
                      const key = `${card.suit}-${card.rank}`;
                      const isShaking = shakeCardKey === key;
                      const di = dealIdx(PLAYER_IDX, i);
                      const cardVisible = dealStep > di;
                      let isPlayable = false;
                      if (!game.animating && game.phase !== "finished") {
                        if (isPlayerAttacker && game.phase === "attack") isPlayable = canAttack(card, game.tableSlots);
                        else if (isPlayerDefender && game.phase === "defense" && selectedSlotIdx !== null) {
                          const slot = game.tableSlots[selectedSlotIdx];
                          if (slot && !slot.defense) isPlayable = canDefend(slot.attack, card, game.trumpSuit);
                        } else if (isPlayerDefender && game.phase === "defense") {
                          isPlayable = game.tableSlots.some((s) => !s.defense && canDefend(s.attack, card, game.trumpSuit));
                        } else if (isPlayerAttacker && game.phase === "throwing") isPlayable = canAttack(card, game.tableSlots);
                      }
                      return (
                        <div key={key} className={cardVisible && dealStep <= di + 1 ? "durak-card-in" : isShaking ? "animate-bounce" : ""}
                          style={{ opacity: cardVisible ? 1 : 0, flexShrink: 0 }}>
                          <DurakCard card={card} size="md" onClick={() => handlePlayerCardClick(card)}
                            dimmed={!isPlayable && isPlayerTurn}
                            draggable={isPlayerTurn && !game.animating}
                            onDragStart={(e) => { e.dataTransfer.setData("durak-card", JSON.stringify(card)); setDragCard(card); if (isPlayerDefender && game.phase === "defense") setSelectedSlotIdx(null); }}
                            onDragEnd={() => setDragCard(null)}
                            className={["hover:-translate-y-3", isPlayable && isPlayerTurn ? "ring-2 ring-[var(--accent-orange)]/60" : ""].join(" ")} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
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

                  const di = dealIdx(PLAYER_IDX, i);
                  const cardVisible = dealStep > di;

                  return (
                    <div
                      key={key}
                      className={cardVisible && dealStep <= di + 1 ? "durak-card-in" : isShaking ? "animate-bounce" : ""}
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: 0,
                        transform: `translateX(calc(-50% + ${offset}px)) rotate(${angle}deg) ${isShaking ? "translateY(-6px)" : ""}`,
                        transformOrigin: "bottom center",
                        transition: isShaking ? "none" : "transform 0.15s ease",
                        zIndex: i,
                        opacity: cardVisible ? 1 : 0,
                        pointerEvents: cardVisible ? "auto" : "none",
                      }}
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
                      {game.outPlayers.has(PLAYER_IDX) ? "✓ " + t("done") : t("noCards")}
                    </span>
                  </div>
                )}
              </div>
              )} {/* end fan/scroll conditional */}
            </div>
          </div>
        </div>
      </div>
    </main>
    </>
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
