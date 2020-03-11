import React from 'react';
import 'firebase/performance';
import { Grid, Header, Icon, Item, Menu, Segment, List } from 'semantic-ui-react';
import "./App.css";
import { useFirestore, useFirestoreCollectionData } from 'reactfire';

function AppMenu() {
  return (
    <Menu inverted>
      <Menu.Item>
        <h1>Conference Meet Up Scoreboard</h1>
      </Menu.Item>
    </Menu>
  )
}

function Player({ player, size = "h5" }) {
  
  return (
      <List.Item >
      <List.Content success>
          <Grid>
            <Grid.Row columns={3}>
              <Grid.Column width={14}>
              <List.Header as={size}>{player.fullName}</List.Header>
              </Grid.Column>
            <Grid.Column textAlign="center" width={1}>
              <List.Header as={size}><Icon color={player.active ? "green" : "grey"} name='circle' /></List.Header>
              </Grid.Column>
            <Grid.Column textAlign="center" width={1}>
                <List.Header as={size}>{player.score}</List.Header>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </List.Content>
      </List.Item>
  );
}

function App() {
  const firestore = useFirestore();
  const baseRef = firestore.collection('players');
  const query = baseRef;
  const players = useFirestoreCollectionData(query);
  const sortedPlayers = players
    .map((p) => {
      return {...p, score: p.introsMade?.length || 0 }
    })
    .sort((a, b) => b.score - a.score);
  
  return (
    <div className="App">
      <AppMenu />
      <React.Suspense fallback="loading...">
        <Grid padded>
          <Grid.Row columns={2}>
            <Grid.Column width={12}>
              <List divided>
                {sortedPlayers.map((p,i) => {
                  let size = i < 4 ? `h${i+1}` : null;
                  return <Player size={size} key={p.shortId} player={p} />
                })}
              </List>
            </Grid.Column>
            <Grid.Column width={4}>
              <Segment textAlign="center">
                <Header as='h2'>Total Active Players</Header>
                <Header id="player-count">{players.filter((p) => p.active).length}</Header>
              </Segment>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </React.Suspense>
    </div>
  );
}

export default App;