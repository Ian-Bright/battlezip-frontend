import { useEffect, useMemo, useState } from 'react';
import { createUseStyles } from 'react-jss';
import Board from 'components/Board';
import { Ship } from 'components/Board/types';
import MainLayout from 'layouts/MainLayout';
import OpponentBoard from 'components/Board/OpponentBoard';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from 'contexts/WalletContext';
import { RootLocation } from 'Locations';
import { useGame } from 'hooks/useGame';
import GameSkeleton from './components/GameSkeleton';
import { playingGame } from 'web3/battleshipGame';
import eth from 'images/eth.svg';
import { firstTurn, turn } from 'web3/battleshipGame';
import { Shot } from './types';

const useStyles = createUseStyles({
  content: {
    display: 'flex',
    gap: '114px',
    marginInline: 'auto',
    width: 'fit-content'
  },
  eth: {
    height: '28px',
    width: '28px'
  },
  fleetLabel: {
    alignItems: 'center',
    borderRadius: '3px',
    color: '#FFFFFF',
    display: 'flex',
    fontSize: '24px',
    fontWeight: 700,
    gap: '16px',
    justifyContent: 'center',
    lineHeight: '34.68px',
    paddingBlock: '2px'
  },
  waitingForOpponent: {
    alignItems: 'center',
    display: 'flex',
    fontSize: '24px',
    fontWeight: 700,
    height: '523px',
    justifyContent: 'center',
    lineHeight: '34.68px'
  }
});

export default function Game(): JSX.Element {
  const { id } = useParams();
  const styles = useStyles();
  const navigate = useNavigate();
  const { address, provider } = useWallet();
  const [opponentShots, setOpponentShots] = useState<Shot[]>([]);
  const [placedShips, setPlacedShips] = useState<Ship[]>([]);
  const [yourShots, setYourShots] = useState<Shot[]>([]);
  const { fetching, game } = useGame(id ?? '');

  const wasHit = (tile: number) => {
    return placedShips.find((ship) => ship.sections.includes(tile));
  };

  const playing = async () => {
    if (!address || !provider) return;
    const res = await playingGame(provider, address);
    return `${res}` === id;
  };

  const restoreBoardState = () => {
    if (!game) return;
    const storedBoard = localStorage.getItem(`BOARD_STATE_${id}_${address}`);
    if (storedBoard) {
      setPlacedShips(JSON.parse(storedBoard));
    }
    const evenShots = game.shots
      .filter((shot: Shot, index: number) => index % 2 === 0)
      .map((shot: Shot) => ({
        hit: shot.hit,
        turn: +shot.turn,
        x: +shot.x,
        y: +shot.y
      }));
    const oddShots = game.shots
      .filter((shot: Shot, index: number) => index % 2 === 1)
      .map((shot: Shot) => ({
        hit: shot.hit,
        turn: +shot.turn,
        x: +shot.x,
        y: +shot.y
      }));
    if (game.startedBy === address) {
      setOpponentShots(oddShots);
      setYourShots(evenShots);
    } else {
      setOpponentShots(evenShots);
      setYourShots(oddShots);
    }
  };

  const showOpponentBoard = useMemo(() => {
    if (!address || !game) return false;
    return (
      (game.startedBy === address && game.joinedBy) ||
      game.startedBy !== address
    );
  }, [address, game]);

  const takeShot = async (shot: Shot) => {
    if (!provider) return;
    const first = !opponentShots.length && !yourShots.length;
    if (first) {
      const tx = await firstTurn(provider, +game.id, [shot.x, shot.y]);
      await tx.wait();
    } else {
      const lastShot = opponentShots[opponentShots.length - 1];
      const hit = !!wasHit(lastShot.x + lastShot.y * 10);
      const tx = await turn(
        provider,
        +game.id,
        hit,
        [shot.x, shot.y],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      );
      await tx.wait();
    }
    setYourShots((prev) => [...prev, shot].sort((a, b) => b.turn - a.turn));
  };

  const totalTurns = useMemo(() => {
    return opponentShots.length + yourShots.length;
  }, [opponentShots, yourShots]);

  const yourTurn = useMemo(() => {
    if (!game) return false;
    const totalShots = totalTurns;
    return game.startedBy === address
      ? totalShots % 2 === 0
      : totalShots % 2 === 1;
  }, [address, game, totalTurns]);

  useEffect(() => {
    if (!fetching) {
      if (game) {
        const historic = game.status === 'OVER';
        const inGame = playing();
        if (!historic && !inGame) {
          navigate(RootLocation);
        } else {
          restoreBoardState();
        }
      } else {
        navigate(RootLocation);
      }
    }
    // eslint-disable-next-line
  }, [address, fetching, game, id, navigate]);

  return (
    <MainLayout>
      {fetching ? (
        <GameSkeleton />
      ) : (
        <div>
          <div className={styles.content}>
            <div style={{ width: '523px' }}>
              <div
                className={styles.fleetLabel}
                style={{ background: '#717C96' }}
              >
                OPPONENT
                {!yourTurn && (
                  <img alt="Eth" className={styles.eth} src={eth} />
                )}
              </div>
              {showOpponentBoard ? (
                <OpponentBoard
                  shots={yourShots}
                  takeShot={takeShot}
                  totalTurns={totalTurns}
                  yourTurn={yourTurn}
                />
              ) : (
                <div className={styles.waitingForOpponent}>
                  WAITING FOR OPPONENT
                </div>
              )}
            </div>
            <div style={{ width: '523px' }}>
              <div
                className={styles.fleetLabel}
                style={{ background: '#FF0055' }}
              >
                YOUR FLEET
                {yourTurn && <img alt="Eth" className={styles.eth} src={eth} />}
              </div>
              <Board
                allPlaced={true}
                opponentShots={opponentShots}
                placedShips={placedShips}
                rotationAxis={''}
                selectedShip={{} as Ship}
                setPlacedShip={() => null}
              />
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
