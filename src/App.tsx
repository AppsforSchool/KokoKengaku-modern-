import { Route, Routes, useParams } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { useViewAs } from './features/viewAs/ViewAsProvider'
import { PerfRouteWatcher } from './components/PerfRouteWatcher'
import LoginPage from './pages/LoginPage'
import RoomListPage from './pages/RoomListPage'
import TalkPage from './pages/TalkPage'
import NotFoundPage from './pages/NotFoundPage'

// ルームごとに別の画面として扱う（ルームIDが変わったら、状態を作り直す）。
// 管理者が、他のアカウントとして閲覧している場合は、閲覧するアカウントが変わったときも、作り直す（前の人の一覧・未読数を、残さないため）。
function TalkRoute() {
	const { roomId } = useParams()
	const { viewAsUserId } = useViewAs()
	return <TalkPage key={`${roomId}|${viewAsUserId ?? ''}`} talkId={roomId || ''} />
}

function RoomListRoute() {
	const { viewAsUserId } = useViewAs()
	return <RoomListPage key={viewAsUserId ?? 'self'} />
}

// ★ ルート（仕様書 §6.1）。旧URLとの対応：
//   index.html → #/login（ログインしていれば #/ へ）  /  app.html → #/  /  talk.html?id=ID → #/talk/ID
//   旧URLは、public/ の小さなリダイレクト用ファイルが、新しいルートに変換する。
export default function App() {
	return (
		<>
			<PerfRouteWatcher />
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route
					path="/"
					element={
						<RequireAuth page="app">
							<RoomListRoute />
						</RequireAuth>
					}
				/>
				<Route
					path="/talk/:roomId"
					element={
						<RequireAuth page="talk">
							<TalkRoute />
						</RequireAuth>
					}
				/>
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</>
	)
}
