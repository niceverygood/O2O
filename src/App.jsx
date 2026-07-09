import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  Heart,
  Home,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Store,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { eventDefinitions, sampleCommunityGroups, sampleDeals } from './data';
import {
  clearProfile,
  clearEvents,
  exportEventsCsv,
  getEvents,
  getProfile,
  getVisitorId,
  initAnalytics,
  saveProfile,
  track,
  useScreenAnalytics,
} from './analytics';
import { clamp, discountedPrice, formatWon } from './utils';

const fallbackImage =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80';
const CREATED_DEALS_KEY = 'o2o_mvp_created_deals';
const CUSTOMER_GROUPS_KEY = 'o2o_mvp_customer_groups';
const CUSTOMER_ORDERS_KEY = 'o2o_mvp_customer_orders';
const FAVORITES_KEY = 'o2o_mvp_favorite_deal_ids';
const HOST_DEALS_KEY = 'o2o_mvp_host_deal_ids';

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadCreatedDeals() {
  return loadJson(CREATED_DEALS_KEY, []);
}

function saveCreatedDeals(deals) {
  saveJson(CREATED_DEALS_KEY, deals);
}

function getDealPrice(deal) {
  if (deal.source === 'customer' && deal.menu?.[0]?.price) return deal.menu[0].price;
  return discountedPrice(deal.originalPrice, deal.discountRate);
}

function normalizeRoute(pathname) {
  if (['/customer', '/owner', '/dashboard'].includes(pathname)) return pathname;
  return '/';
}

function App() {
  const [analyticsReady] = useState(() => initAnalytics());
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname));
  const [profile, setProfile] = useState(() => getProfile());
  const [customerScreen, setCustomerScreen] = useState(profile ? 'list' : 'onboarding');
  const [ownerScreen, setOwnerScreen] = useState('form');
  const [createdDeals, setCreatedDeals] = useState(() => loadCreatedDeals());
  const [customerGroups, setCustomerGroups] = useState(() => loadJson(CUSTOMER_GROUPS_KEY, []));
  const [orders, setOrders] = useState(() => loadJson(CUSTOMER_ORDERS_KEY, []));
  const [favoriteIds, setFavoriteIds] = useState(() => loadJson(FAVORITES_KEY, []));
  const [hostDealIds, setHostDealIds] = useState(() => loadJson(HOST_DEALS_KEY, []));
  const [selectedDeal, setSelectedDeal] = useState(() => loadCreatedDeals()[0] || sampleDeals[0]);

  const deals = useMemo(
    () => [...createdDeals, ...customerGroups, ...sampleDeals, ...sampleCommunityGroups],
    [createdDeals, customerGroups],
  );

  useEffect(() => {
    const handlePopState = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    setRoute(nextRoute);
    track('app_opened', { app: nextRoute.replace('/', '') || 'launcher' });
  };

  const handleProfileSubmit = (nextProfile) => {
    saveProfile(nextProfile);
    setProfile(nextProfile);
    setCustomerScreen('list');
    track('profile_submitted', {
      neighborhood: nextProfile.neighborhood,
      tester_type: nextProfile.testerType,
    });
  };

  const handleLogout = () => {
    clearProfile();
    setProfile(null);
    setCustomerScreen('onboarding');
    track('profile_logged_out', {});
  };

  const addOwnerDeal = (ownerProduct) => {
    const deal = {
      id: `owner-${Date.now()}`,
      source: 'merchant',
      saleType: ownerProduct.saleType,
      category: ownerProduct.category,
      store: ownerProduct.storeName,
      title: ownerProduct.productName,
      description: ownerProduct.description,
      address: ownerProduct.pickupPlace,
      distance: '테스트 매장',
      deadline: ownerProduct.deadline,
      methods: ownerProduct.methods,
      stock: Number(ownerProduct.stock),
      eventStart: ownerProduct.eventStart,
      eventEnd: ownerProduct.eventEnd,
      originalPrice: Number(ownerProduct.originalPrice),
      discountRate: Number(ownerProduct.discountRate),
      current: 0,
      target: Number(ownerProduct.saleType === 'instant' ? ownerProduct.stock : ownerProduct.maxQuantity),
      likes: 0,
      image: ownerProduct.image || fallbackImage,
      menu: [
        {
          id: 'owner-menu-1',
          name: ownerProduct.productName,
          price: discountedPrice(ownerProduct.originalPrice, ownerProduct.discountRate),
          option: ownerProduct.methods.join(', '),
        },
      ],
    };
    setCreatedDeals((current) => {
      const next = [deal, ...current];
      saveCreatedDeals(next);
      return next;
    });
    setSelectedDeal(deal);
    setOwnerScreen('done');
  };

  const createCustomerGroup = (draft) => {
    const group = {
      id: `customer-${Date.now()}`,
      source: 'customer',
      saleType: 'community',
      category: draft.category,
      store: `${profile?.neighborhood || '동네'} 호스트`,
      title: draft.title,
      description: draft.description || draft.memo,
      address: draft.pickupPlace,
      distance: '내 주변',
      deadline: `${draft.deadlineDate} ${draft.deadlineTime}`,
      methods: [draft.method],
      originalPrice: Number(draft.expectedPrice || discountedPrice(draft.baseDeal.originalPrice, draft.baseDeal.discountRate)),
      discountRate: 0,
      current: 1,
      target: Number(draft.maxPeople),
      likes: 0,
      image: draft.image || draft.baseDeal.image || fallbackImage,
      menu: [
        {
          id: `customer-menu-${Date.now()}`,
          name: draft.title,
          price: Number(draft.expectedPrice || discountedPrice(draft.baseDeal.originalPrice, draft.baseDeal.discountRate)),
          option: draft.category,
        },
      ],
    };
    setCustomerGroups((current) => {
      const next = [group, ...current];
      saveJson(CUSTOMER_GROUPS_KEY, next);
      return next;
    });
    setSelectedDeal(group);
    track('group_created', {
      deal_id: group.id,
      source: 'customer',
      category: group.category,
      method: draft.method,
      title: group.title,
    });
    return group;
  };

  const saveCustomerOrder = (order) => {
    setOrders((current) => {
      const next = [
        {
          id: `order-${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...order,
        },
        ...current,
      ];
      saveJson(CUSTOMER_ORDERS_KEY, next);
      return next;
    });
  };

  const toggleFavorite = (deal) => {
    setFavoriteIds((current) => {
      const active = current.includes(deal.id);
      const next = active ? current.filter((id) => id !== deal.id) : [deal.id, ...current];
      saveJson(FAVORITES_KEY, next);
      track('like_clicked', { deal_id: deal.id, active: !active, source: 'customer_tab' });
      return next;
    });
  };

  const applyHost = (deal) => {
    setHostDealIds((current) => {
      const next = current.includes(deal.id) ? current : [deal.id, ...current];
      saveJson(HOST_DEALS_KEY, next);
      return next;
    });
    track('host_applied', { deal_id: deal.id, method: deal.methods?.join(', ') });
  };

  if (route === '/') {
    return <AppLauncher onNavigate={navigateTo} />;
  }

  if (route === '/dashboard') {
    return (
      <main className="app dashboard-app">
        <section className="workspace">
          <StandaloneHeader
            eyebrow="검증 환경"
            title="검증 대시보드"
            active="dashboard"
            onNavigate={navigateTo}
          />
          <Dashboard analyticsReady={analyticsReady} />
        </section>
        <EventMonitor analyticsReady={analyticsReady} />
      </main>
    );
  }

  return (
    <main className="app individual-app">
      <section className="workspace">
        <StandaloneHeader
          eyebrow={route === '/customer' ? '사용자 테스트' : '사장님 등록'}
          title={route === '/customer' ? '사용자 앱' : '사장님 앱'}
          active={route === '/customer' ? 'customer' : 'owner'}
          onNavigate={navigateTo}
        />

        <PhoneFrame>
          {route === '/customer' && (
            <CustomerApp
              deals={deals}
              profile={profile}
              orders={orders}
              favoriteIds={favoriteIds}
              hostDealIds={hostDealIds}
              selectedDeal={selectedDeal}
              screen={customerScreen}
              onProfileSubmit={handleProfileSubmit}
              onSelectDeal={(deal) => {
                setSelectedDeal(deal);
                setCustomerScreen('detail');
                track('open_listing', {
                  deal_id: deal.id,
                  category: deal.category,
                  store: deal.store,
                  title: deal.title,
                });
              }}
              onScreen={setCustomerScreen}
              onOrderCreate={saveCustomerOrder}
              onGroupCreate={createCustomerGroup}
              onToggleFavorite={toggleFavorite}
              onHostApply={applyHost}
              onLogout={handleLogout}
            />
          )}
          {route === '/owner' && (
            <OwnerApp
              screen={ownerScreen}
              selectedDeal={selectedDeal}
              onScreen={setOwnerScreen}
              onCreate={addOwnerDeal}
              onPreviewCustomer={() => {
                navigateTo('/customer');
                setCustomerScreen('detail');
              }}
            />
          )}
        </PhoneFrame>
      </section>
    </main>
  );
}

function AppLauncher({ onNavigate }) {
  useScreenAnalytics('app_launcher');
  const apps = [
    {
      id: 'customer',
      title: '사용자 앱',
      description: '공동구매 리스트, 상세, 참여, 그룹방 생성, 설문 흐름',
      icon: Users,
      path: '/customer',
    },
    {
      id: 'owner',
      title: '사장님 앱',
      description: '상품 등록, 할인율 자동 계산, 재고/수령 방식/마감 설정',
      icon: Store,
      path: '/owner',
    },
    {
      id: 'dashboard',
      title: '검증 대시보드',
      description: 'Funnel, 체류시간, 설문, CSV, 이벤트 로그 확인',
      icon: BarChart3,
      path: '/dashboard',
    },
  ];

  return (
    <main className="launcher-page">
      <section className="launcher-hero">
        <p className="eyebrow">위치기반 공동구매 O2O</p>
        <h1>클릭형 MVP</h1>
        <p>합의된 세 산출물을 각각 독립 화면으로 분리했습니다.</p>
      </section>
      <section className="launcher-grid">
        {apps.map(({ id, title, description, icon: Icon, path }) => (
          <button key={id} className="launcher-card" onClick={() => onNavigate(path)}>
            <Icon size={28} />
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </section>
    </main>
  );
}

function StandaloneHeader({ eyebrow, title, active, onNavigate }) {
  const links = [
    { id: 'customer', label: '사용자 앱', path: '/customer', icon: Users },
    { id: 'owner', label: '사장님 앱', path: '/owner', icon: Store },
    { id: 'dashboard', label: '대시보드', path: '/dashboard', icon: BarChart3 },
  ];

  return (
    <header className="standalone-header">
      <button className="home-link" onClick={() => onNavigate('/')}>
        <Home size={16} />
        앱 선택
      </button>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <nav className="standalone-links">
        {links.map(({ id, label, path, icon: Icon }) => (
          <button
            key={id}
            className={active === id ? 'active' : ''}
            onClick={() => onNavigate(path)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="phone-frame">
      <StatusBar />
      {children}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <span className="status-icons">●●● 5G ▰</span>
    </div>
  );
}

function CustomerApp({
  deals,
  profile,
  orders,
  favoriteIds,
  hostDealIds,
  selectedDeal,
  screen,
  onProfileSubmit,
  onSelectDeal,
  onScreen,
  onOrderCreate,
  onGroupCreate,
  onToggleFavorite,
  onHostApply,
  onLogout,
}) {
  if (!profile || screen === 'onboarding') {
    return <Onboarding onSubmit={onProfileSubmit} />;
  }

  if (screen === 'detail') {
    return (
      <DealDetail
        deal={selectedDeal}
        onBack={() => onScreen('list')}
        onScreen={onScreen}
        isFavorite={favoriteIds.includes(selectedDeal.id)}
        onToggleFavorite={onToggleFavorite}
        hostMatched={Boolean(selectedDeal.hostMatched || hostDealIds.includes(selectedDeal.id))}
        onHostApply={onHostApply}
      />
    );
  }

  if (screen === 'join') {
    return (
      <JoinFlow
        deal={selectedDeal}
        onBack={() => onScreen('detail')}
        onScreen={onScreen}
        onOrderCreate={onOrderCreate}
        onGroupCreate={onGroupCreate}
      />
    );
  }

  if (screen === 'group') {
    return (
      <GroupCreator
        deal={selectedDeal}
        onBack={() => onScreen('detail')}
        onScreen={onScreen}
        onOrderCreate={onOrderCreate}
        onGroupCreate={onGroupCreate}
      />
    );
  }

  if (screen === 'complete') {
    return <Completion deal={selectedDeal} onScreen={onScreen} />;
  }

  if (screen === 'survey') {
    return <Survey onScreen={onScreen} />;
  }

  if (screen === 'explore') {
    return (
      <ExploreTab
        deals={deals}
        hostDealIds={hostDealIds}
        onSelectDeal={onSelectDeal}
        onScreen={onScreen}
      />
    );
  }

  if (screen === 'orders') {
    return <OrdersTab orders={orders} deals={deals} onSelectDeal={onSelectDeal} onScreen={onScreen} />;
  }

  if (screen === 'favorites') {
    return (
      <FavoritesTab
        favoriteDeals={deals.filter((deal) => favoriteIds.includes(deal.id))}
        hostDealIds={hostDealIds}
        onSelectDeal={onSelectDeal}
        onScreen={onScreen}
      />
    );
  }

  if (screen === 'profile') {
    return (
      <ProfileTab
        profile={profile}
        orders={orders}
        favoriteCount={favoriteIds.length}
        onScreen={onScreen}
        onLogout={onLogout}
      />
    );
  }

  return (
    <DealList
      deals={deals}
      profile={profile}
      hostDealIds={hostDealIds}
      onSelectDeal={onSelectDeal}
      onScreen={onScreen}
    />
  );
}

function Onboarding({ onSubmit }) {
  useScreenAnalytics('onboarding');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    neighborhood: '판교',
    testerType: '사용자',
    consent: false,
  });

  const disabled = !form.name || !form.phone || !form.consent;

  return (
    <section className="screen onboarding-screen">
      <div className="brand-block">
        <ShoppingBag size={30} />
        <p className="eyebrow">위치기반 공동구매</p>
        <h1>모여사요</h1>
      </div>

      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) onSubmit(form);
        }}
      >
        <label>
          이름
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="홍길동"
          />
        </label>
        <label>
          연락처
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="010-0000-0000"
            inputMode="tel"
          />
        </label>
        <label>
          동네
          <select
            value={form.neighborhood}
            onChange={(event) => setForm({ ...form, neighborhood: event.target.value })}
          >
            <option>판교</option>
            <option>화곡</option>
            <option>목동</option>
            <option>운중동</option>
          </select>
        </label>
        <div className="segmented-control">
          {['사용자', '사장님', '투자자'].map((type) => (
            <button
              type="button"
              key={type}
              className={form.testerType === type ? 'segment active' : 'segment'}
              onClick={() => setForm({ ...form, testerType: type })}
            >
              {type}
            </button>
          ))}
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(event) => setForm({ ...form, consent: event.target.checked })}
          />
          개인정보 수집 및 테스트 행동 데이터 수집 동의
        </label>
        <button className="primary-button" type="submit" disabled={disabled}>
          <Check size={18} />
          테스트 시작
        </button>
      </form>
    </section>
  );
}

function DealList({ deals, profile, hostDealIds, onSelectDeal, onScreen }) {
  useScreenAnalytics('deal_list', { neighborhood: profile.neighborhood });
  const [category, setCategory] = useState('전체');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');

  const categories = ['전체', '카페', '식사', '간식', '편의점', '음식', '장보기/마트', '식재료', '생활용품', '기타'];
  const filtered = deals.filter((deal) => {
    const matchCategory = category === '전체' || deal.category === category;
    const matchSource = source === 'all' || deal.source === source;
    const matchQuery = `${deal.title} ${deal.store} ${deal.description || ''}`.includes(query);
    return matchCategory && matchSource && matchQuery;
  });

  return (
    <section className="screen">
      <header className="top-nav">
        <div>
          <p className="eyebrow">현재 위치</p>
          <h1>{profile.neighborhood} 공동구매</h1>
        </div>
        <button className="icon-button" aria-label="알림">
          <Bell size={20} />
        </button>
      </header>

      <div className="search-field">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="매장 또는 상품 검색" />
      </div>

      <div className="source-filter">
        {[
          { id: 'all', label: '전체', icon: ShoppingBag },
          { id: 'merchant', label: '사장님', icon: Store },
          { id: 'customer', label: '사용자', icon: User },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={source === id ? 'active' : ''}
            onClick={() => {
              setSource(id);
              track('source_filter_clicked', { source: id });
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="chip-row">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? 'chip active' : 'chip'}
            onClick={() => {
              setCategory(item);
              track('filter_clicked', { filter: item });
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="deal-list">
        {filtered.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            hostMatched={Boolean(deal.hostMatched || hostDealIds.includes(deal.id))}
            onClick={() => onSelectDeal(deal)}
          />
        ))}
      </div>

      <BottomNav active="home" onSelect={onScreen} />
    </section>
  );
}

function DealCard({ deal, hostMatched, onClick }) {
  const isCustomerGroup = deal.source === 'customer';
  const isInstant = deal.saleType === 'instant';
  const typeLabel = isCustomerGroup ? '사용자 그룹' : isInstant ? '선착순 즉시할인' : '사장님 공구';
  const TypeIcon = isCustomerGroup ? User : Store;
  const price = getDealPrice(deal);

  return (
    <button className="deal-card" onClick={onClick}>
      <img src={deal.image} alt="" />
      <div className="deal-content">
        <div className="deal-title-row">
          <strong>{deal.title}</strong>
          <span>{isInstant ? '선착순' : deal.deadline}</span>
        </div>
        <div className="deal-badges">
          <span className={isCustomerGroup ? 'type-badge customer' : 'type-badge merchant'}>
            <TypeIcon size={12} />
            {typeLabel}
          </span>
          {hostMatched && <span className="type-badge host">호스트 모집 완료</span>}
        </div>
        <p>{isCustomerGroup ? deal.description : deal.store}</p>
        <p className="muted-line">
          <MapPin size={14} />
          {deal.address} · {deal.distance}
        </p>
        {isInstant && deal.eventStart && (
          <p className="event-time-line">
            <Clock size={13} />
            오늘 {deal.eventStart} ~ {deal.eventEnd} 진행
          </p>
        )}
        <Progress current={deal.current} target={deal.target} />
        <div className="price-row">
          <span>{isCustomerGroup ? '예상 분담금' : `${deal.discountRate}% 할인`}</span>
          <strong>{formatWon(price)}</strong>
        </div>
      </div>
    </button>
  );
}

function ExploreTab({ deals, hostDealIds, onSelectDeal, onScreen }) {
  useScreenAnalytics('customer_explore');
  const urgentDeals = [...deals].sort((a, b) => b.discountRate - a.discountRate);

  return (
    <section className="screen">
      <header className="top-nav">
        <div>
          <p className="eyebrow">탐색</p>
          <h1>지금 모이는 공구</h1>
        </div>
        <button
          className="icon-button"
          aria-label="그룹 만들기"
          onClick={() => {
            track('bottom_tab_action_clicked', { action: 'create_group' });
            onSelectDeal(deals[0]);
            onScreen('group');
          }}
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="insight-strip">
        <div>
          <span>근처 진행중</span>
          <strong>{deals.length}개</strong>
        </div>
        <div>
          <span>최대 할인</span>
          <strong>{Math.max(...deals.map((deal) => deal.discountRate))}%</strong>
        </div>
        <div>
          <span>그룹배달</span>
          <strong>가능</strong>
        </div>
      </div>

      <div className="section-copy">
        <h2>추천 공동구매</h2>
        <p>할인율과 참여 속도가 높은 상품을 먼저 보여줍니다.</p>
      </div>

      <div className="deal-list compact-deal-list">
        {urgentDeals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            hostMatched={Boolean(deal.hostMatched || hostDealIds.includes(deal.id))}
            onClick={() => onSelectDeal(deal)}
          />
        ))}
      </div>

      <BottomNav active="explore" onSelect={onScreen} />
    </section>
  );
}

function OrdersTab({ orders, deals, onSelectDeal, onScreen }) {
  useScreenAnalytics('customer_orders', { order_count: orders.length });
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));

  return (
    <section className="screen">
      <header className="top-nav">
        <div>
          <p className="eyebrow">내 주문</p>
          <h1>참여 내역</h1>
        </div>
        <ShoppingBag size={22} />
      </header>

      {orders.length === 0 ? (
        <EmptyCustomerState
          icon={ShoppingBag}
          title="아직 참여 내역이 없습니다"
          body="공동구매에 참여하면 마감 시간과 수령 방식이 여기에 저장됩니다."
          actionLabel="공구 보러가기"
          onAction={() => onScreen('list')}
        />
      ) : (
        <div className="order-card-list">
          {orders.map((order) => {
            const deal = dealById.get(order.dealId) || order.deal;
            return (
              <button className="order-card" key={order.id} onClick={() => deal && onSelectDeal(deal)}>
                <div className="order-status-line">
                  <span>{order.type === 'group' ? '그룹방 생성' : '참여 완료'}</span>
                  <strong>{order.method}</strong>
                </div>
                <h2>{deal?.title || order.title}</h2>
                <p>{deal?.store || order.store}</p>
                <div className="order-meta-grid">
                  <span>수량 {order.selectedCount || order.quantity || 1}개</span>
                  <span>{formatWon(order.total || discountedPrice(deal?.originalPrice, deal?.discountRate))}</span>
                  <span>{order.time || order.deadline || deal?.deadline}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <BottomNav active="orders" onSelect={onScreen} />
    </section>
  );
}

function FavoritesTab({ favoriteDeals, hostDealIds, onSelectDeal, onScreen }) {
  useScreenAnalytics('customer_favorites', { favorite_count: favoriteDeals.length });

  return (
    <section className="screen">
      <header className="top-nav">
        <div>
          <p className="eyebrow">찜</p>
          <h1>관심 공동구매</h1>
        </div>
        <Heart size={22} />
      </header>

      {favoriteDeals.length === 0 ? (
        <EmptyCustomerState
          icon={Heart}
          title="찜한 공동구매가 없습니다"
          body="상세 화면의 하트 버튼을 누르면 관심 상품을 다시 볼 수 있습니다."
          actionLabel="홈으로 이동"
          onAction={() => onScreen('list')}
        />
      ) : (
        <div className="deal-list">
          {favoriteDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              hostMatched={Boolean(deal.hostMatched || hostDealIds.includes(deal.id))}
              onClick={() => onSelectDeal(deal)}
            />
          ))}
        </div>
      )}

      <BottomNav active="favorites" onSelect={onScreen} />
    </section>
  );
}

function ProfileTab({ profile, orders, favoriteCount, onScreen, onLogout }) {
  useScreenAnalytics('customer_profile');

  return (
    <section className="screen">
      <header className="top-nav">
        <div>
          <p className="eyebrow">마이</p>
          <h1>테스트 프로필</h1>
        </div>
        <User size={22} />
      </header>

      <div className="profile-card">
        <div className="profile-avatar">{profile.name.slice(0, 1)}</div>
        <div>
          <h2>{profile.name}</h2>
          <p>{profile.neighborhood} · {profile.testerType}</p>
        </div>
      </div>

      <div className="insight-strip">
        <div>
          <span>참여</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>찜</span>
          <strong>{favoriteCount}</strong>
        </div>
        <div>
          <span>동의</span>
          <strong>{profile.consent ? '완료' : '대기'}</strong>
        </div>
      </div>

      <div className="profile-menu">
        <button onClick={() => onScreen('orders')}>
          <ShoppingBag size={18} />
          내 주문 보기
        </button>
        <button onClick={() => onScreen('favorites')}>
          <Heart size={18} />
          찜 목록 보기
        </button>
        <button onClick={() => onScreen('survey')}>
          <MessageCircle size={18} />
          설문 다시 작성
        </button>
        <button onClick={onLogout}>
          <X size={18} />
          로그아웃
        </button>
      </div>

      <BottomNav active="profile" onSelect={onScreen} />
    </section>
  );
}

function EmptyCustomerState({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <div className="empty-customer-state">
      <Icon size={34} />
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="secondary-button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

function DealDetail({ deal, onBack, onScreen, isFavorite, onToggleFavorite, hostMatched, onHostApply }) {
  useScreenAnalytics('deal_detail', { deal_id: deal.id, category: deal.category });
  const [sharing, setSharing] = useState(false);
  const isCustomerGroup = deal.source === 'customer';
  const isInstant = deal.saleType === 'instant';
  const canHostApply = !isInstant && !isCustomerGroup && (deal.methods || []).some((method) => ['그룹배달', '픽업'].includes(method));

  return (
    <section className="screen detail-screen">
      <header className="top-nav compact">
        <button className="icon-button" onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={22} />
        </button>
        <h1>공동구매 상세</h1>
        <div className="inline-actions">
          <button className="icon-button" onClick={() => setSharing(true)} aria-label="공유">
            <Share2 size={20} />
          </button>
          <button
            className={isFavorite ? 'icon-button liked' : 'icon-button'}
            onClick={() => {
              onToggleFavorite(deal);
            }}
            aria-label="좋아요"
          >
            <Heart size={20} />
          </button>
        </div>
      </header>

      <img className="hero-image" src={deal.image} alt="" />

      <div className="content-block">
        <div className="detail-badge-row">
          <span className={isCustomerGroup ? 'type-badge customer' : 'type-badge merchant'}>
            {isCustomerGroup ? <User size={12} /> : <Store size={12} />}
            {isCustomerGroup ? '사용자 호스트 그룹' : isInstant ? '선착순 즉시할인 상품' : '사장님 공동구매'}
          </span>
          {hostMatched && <span className="type-badge host">호스트 모집 완료</span>}
        </div>
        <p className="deadline-line">
          <Clock size={15} />
          {isInstant && deal.eventStart ? `오늘 ${deal.eventStart} ~ ${deal.eventEnd} 선착순 즉시할인` : `${deal.deadline} 마감`}
        </p>
        <h2>{deal.store}</h2>
        <p className="body-copy">{deal.description}</p>
        <p className="muted-line">
          <MapPin size={14} />
          {deal.address}
        </p>
      </div>

      <div className="content-block">
        <Progress current={deal.current} target={deal.target} />
        <div className="detail-price-grid">
          <span>정상가</span>
          <del>{formatWon(deal.originalPrice)}</del>
          <span>{isCustomerGroup ? '예상 분담금' : isInstant ? '선착순 할인가' : '공동구매가'}</span>
          <strong>{formatWon(getDealPrice(deal))}</strong>
        </div>
      </div>

      {canHostApply && (
        <div className="host-apply-box">
          <div>
            <strong>{hostMatched ? '호스트 매칭 완료' : '호스트 지원 가능'}</strong>
            <p>{hostMatched ? '참여자 중 호스트가 확정된 상태로 표시됩니다.' : '픽업 또는 그룹배달을 맡을 참여자를 모집합니다.'}</p>
          </div>
          <button
            className={hostMatched ? 'secondary-button compact-button' : 'primary-button compact-button'}
            onClick={() => onHostApply(deal)}
            disabled={hostMatched}
          >
            <Users size={16} />
            {hostMatched ? '확정됨' : '지원하기'}
          </button>
        </div>
      )}

      <div className="menu-preview">
        {deal.menu.map((item) => (
          <div key={item.id} className="menu-line">
            <span>{item.name}</span>
            <strong>{formatWon(item.price)}</strong>
          </div>
        ))}
      </div>

      <div className="sticky-actions">
        <button
          className="secondary-button"
          onClick={() => {
            onScreen('group');
            track('group_create_started', { deal_id: deal.id });
          }}
        >
          <Users size={18} />
          {isCustomerGroup ? '비슷한 그룹 만들기' : '그룹방 만들기'}
        </button>
        <button
          className="primary-button"
          onClick={() => {
            onScreen('join');
            track(isInstant ? 'instant_checkout_started' : 'join_started', { deal_id: deal.id });
          }}
        >
          <ShoppingBag size={18} />
          {isInstant ? '선착순 할인 받기' : '참여하기'}
        </button>
      </div>

      {sharing && <ShareSheet deal={deal} onClose={() => setSharing(false)} />}
    </section>
  );
}

function ShareSheet({ deal, onClose }) {
  const channels = [
    { id: 'kakao', label: '카카오톡', icon: MessageCircle },
    { id: 'message', label: '문자', icon: Send },
    { id: 'copy', label: '링크 복사', icon: LinkIcon },
  ];

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="bottom-sheet">
        <div className="sheet-header">
          <h2>공동구매 링크 공유</h2>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <div className="share-summary">
          <img src={deal.image} alt="" />
          <div>
            <strong>{deal.title}</strong>
            <p>{deal.store}</p>
          </div>
        </div>
        <div className="share-grid">
          {channels.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === 'copy') navigator.clipboard?.writeText(window.location.href);
                track('share_clicked', { channel: id, deal_id: deal.id });
                onClose();
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function JoinFlow({ deal, onBack, onScreen, onOrderCreate }) {
  useScreenAnalytics('join_flow', { deal_id: deal.id });
  const initialQuantities = useMemo(
    () => Object.fromEntries(deal.menu.map((item, index) => [item.id, index === 0 ? 1 : 0])),
    [deal.id],
  );
  const receiptMethods = deal.methods?.length ? deal.methods : ['픽업', '배달', '그룹배달', '택배'];
  const [quantities, setQuantities] = useState(initialQuantities);
  const [method, setMethod] = useState(receiptMethods[0]);
  const [time, setTime] = useState('오늘 20:30');
  const [note, setNote] = useState('');
  const isInstant = deal.saleType === 'instant';

  const total = deal.menu.reduce((sum, item) => sum + item.price * quantities[item.id], 0);
  const selectedCount = Object.values(quantities).reduce((sum, value) => sum + value, 0);

  const changeQuantity = (id, delta) => {
    const next = clamp((quantities[id] || 0) + delta, 0, 20);
    setQuantities({ ...quantities, [id]: next });
    track('quantity_changed', { deal_id: deal.id, menu_id: id, quantity: next });
  };

  return (
    <section className="screen">
      <header className="top-nav compact">
        <button className="icon-button" onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={22} />
        </button>
        <h1>메뉴 선택</h1>
        <span />
      </header>

      <div className="menu-select-list">
        {deal.menu.map((item) => (
          <div className="menu-select-row" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <p>{item.option}</p>
              <span>{formatWon(item.price)}</span>
            </div>
            <Counter value={quantities[item.id]} onMinus={() => changeQuantity(item.id, -1)} onPlus={() => changeQuantity(item.id, 1)} />
          </div>
        ))}
      </div>

      <div className="content-block">
        <h2>수령 방식</h2>
        <div className="segmented-control">
          {receiptMethods.map((item) => (
            <button
              type="button"
              key={item}
              className={method === item ? 'segment active' : 'segment'}
              onClick={() => {
                setMethod(item);
                track('method_selected', { deal_id: deal.id, method: item });
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="form-stack compact-form">
        <label>
          수령 시간
          <select value={time} onChange={(event) => setTime(event.target.value)}>
            <option>오늘 20:00</option>
            <option>오늘 20:30</option>
            <option>오늘 21:00</option>
          </select>
        </label>
        <label>
          요청사항
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="매장에 전달할 내용" />
        </label>
      </div>

      <div className="order-summary">
        <div>
          <span>선택 수량</span>
          <strong>{selectedCount}개</strong>
        </div>
        <div>
          <span>주문 금액</span>
          <strong>{formatWon(total)}</strong>
        </div>
      </div>

      <div className="sticky-actions single">
        <button
          className="primary-button"
          disabled={selectedCount === 0}
          onClick={() => {
            track('checkout_started', { deal_id: deal.id, total, method, time });
            track('purchase_completed', { deal_id: deal.id, total, method, time, note, selected_count: selectedCount });
            onOrderCreate({
              type: 'purchase',
              dealId: deal.id,
              deal,
              title: deal.title,
              store: deal.store,
              total,
              method,
              time,
              note,
              selectedCount,
            });
            onScreen('complete');
          }}
        >
          <Check size={18} />
          {isInstant ? '구매 신청 완료' : '참여 완료하기'}
        </button>
      </div>
    </section>
  );
}

function GroupCreator({ deal, onBack, onScreen, onOrderCreate, onGroupCreate }) {
  useScreenAnalytics('group_creator', { deal_id: deal.id });
  const [form, setForm] = useState({
    title: deal.source === 'customer' ? deal.title : `${deal.title} 같이 구매해요`,
    category: deal.category || '음식',
    description: deal.description || '',
    image: '',
    minPeople: 3,
    maxPeople: 5,
    quantity: 5,
    method: '그룹배달',
    expectedPrice: getDealPrice(deal),
    deadlineDate: '2026-07-12',
    deadlineTime: '20:00',
    pickupPlace: '아파트 정문 앞',
    conditionSave: true,
    conditionFirstCome: false,
    memo: '',
  });

  const updateNumber = (key, delta, min, max) => {
    setForm((current) => ({ ...current, [key]: clamp(current[key] + delta, min, max) }));
  };

  const handleImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
    track('group_image_uploaded', { file_type: file.type, size: file.size });
  };

  return (
    <section className="screen">
      <header className="top-nav compact">
        <button className="icon-button" onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={22} />
        </button>
        <h1>호스트 그룹 생성</h1>
        <Heart size={19} />
      </header>

      <div className="content-block">
        <h2>참고 상품</h2>
        <div className="selected-store">
          <img src={deal.image} alt="" />
          <div>
            <strong>{deal.store}</strong>
            <p>{deal.address}</p>
          </div>
        </div>
      </div>

      <div className="group-image-uploader">
        <img src={form.image || deal.image} alt="" />
        <label className="secondary-button">
          <Upload size={18} />
          그룹 이미지 변경
          <input type="file" accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} />
        </label>
      </div>

      <div className="form-stack compact-form">
        <label>
          그룹 제목
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label>
          카테고리
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option>음식</option>
            <option>장보기/마트</option>
            <option>카페</option>
            <option>식재료</option>
            <option>생활용품</option>
            <option>기타</option>
          </select>
        </label>
        <label>
          간단 설명
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="예: 배달비 아끼실 분 같이 주문해요"
          />
        </label>
      </div>

      <div className="creator-grid">
        <FieldCounter label="최소 인원" value={form.minPeople} onMinus={() => updateNumber('minPeople', -1, 2, 20)} onPlus={() => updateNumber('minPeople', 1, 2, 20)} />
        <FieldCounter label="최대 인원" value={form.maxPeople} onMinus={() => updateNumber('maxPeople', -1, form.minPeople, 50)} onPlus={() => updateNumber('maxPeople', 1, form.minPeople, 50)} />
        <FieldCounter label="총 수량" value={form.quantity} onMinus={() => updateNumber('quantity', -1, 1, 100)} onPlus={() => updateNumber('quantity', 1, 1, 100)} />
      </div>

      <div className="content-block">
        <h2>마감 시간</h2>
        <div className="date-time-row">
          <label>
            <Calendar size={16} />
            <input
              type="date"
              value={form.deadlineDate}
              onChange={(event) => setForm({ ...form, deadlineDate: event.target.value })}
            />
          </label>
          <label>
            <Clock size={16} />
            <input
              type="time"
              value={form.deadlineTime}
              onChange={(event) => setForm({ ...form, deadlineTime: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="form-stack compact-form">
        <label>
          수령 방식
          <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
            <option>그룹배달</option>
            <option>픽업</option>
            <option>배달</option>
            <option>택배</option>
          </select>
        </label>
        <label>
          예상 분담금
          <input
            type="number"
            value={form.expectedPrice}
            onChange={(event) => setForm({ ...form, expectedPrice: Number(event.target.value) })}
          />
        </label>
        <label>
          픽업 위치
          <input
            value={form.pickupPlace}
            onChange={(event) => setForm({ ...form, pickupPlace: event.target.value })}
          />
        </label>
        <label>
          기타 조건
          <input value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="예: 같은 동 주민 우선" />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.conditionSave}
            onChange={(event) => setForm({ ...form, conditionSave: event.target.checked })}
          />
          공동구매 성사 시 할인 적용
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.conditionFirstCome}
            onChange={(event) => setForm({ ...form, conditionFirstCome: event.target.checked })}
          />
          선착순 마감
        </label>
      </div>

      <div className="sticky-actions single">
        <button
          className="primary-button"
          onClick={() => {
            const createdGroup = onGroupCreate({ ...form, baseDeal: deal });
            onOrderCreate({
              type: 'group',
              dealId: createdGroup.id,
              deal: createdGroup,
              title: createdGroup.title,
              store: createdGroup.store,
              total: form.expectedPrice * form.quantity,
              method: form.method,
              deadline: `${form.deadlineDate} ${form.deadlineTime}`,
              quantity: form.quantity,
              selectedCount: form.quantity,
            });
            onScreen('complete');
          }}
          disabled={!form.title || !form.category}
        >
          <Users size={18} />
          그룹방 생성
        </button>
      </div>
    </section>
  );
}

function Completion({ deal, onScreen }) {
  useScreenAnalytics('completion', { deal_id: deal.id });
  const isInstant = deal.saleType === 'instant';
  const isCustomerGroup = deal.source === 'customer';
  return (
    <section className="screen complete-screen">
      <div className="success-mark">
        <Check size={34} />
      </div>
      <h1>{isInstant ? '구매 신청 완료' : isCustomerGroup ? '그룹 참여 완료' : '공동구매 참여 완료'}</h1>
      <p>{deal.store} {isInstant ? '선착순 즉시할인 신청이' : '공동구매 신청이'} 저장되었습니다.</p>

      <div className="completion-summary">
        <div>
          <span>마감</span>
          <strong>{deal.deadline}</strong>
        </div>
        <div>
          <span>수령 장소</span>
          <strong>{deal.address}</strong>
        </div>
      </div>

      <button className="primary-button" onClick={() => onScreen('survey')}>
        <MessageCircle size={18} />
        설문 작성
      </button>
      <button className="secondary-button" onClick={() => onScreen('list')}>
        <Home size={18} />
        홈으로
      </button>
    </section>
  );
}

function Survey({ onScreen }) {
  useScreenAnalytics('survey');
  const [answer, setAnswer] = useState({
    reason: '더 저렴하게 구매할 수 있어서',
    discountExpectation: '15%',
    hostIntent: '조건이 맞으면 해보고 싶다',
    preferredCategory: '음식',
    revisitIntent: '이용할 것 같다',
    feedback: '',
  });
  const update = (key, value) => setAnswer((current) => ({ ...current, [key]: value }));

  const surveyGroups = [
    {
      key: 'reason',
      title: '이번 공동구매에 참여한 가장 큰 이유',
      options: [
        '더 저렴하게 구매할 수 있어서',
        '배달비를 아낄 수 있어서',
        '대용량 상품을 부담 없이 나눠 살 수 있어서',
        '이웃과 함께 구매하는 것이 편리해서',
        '새로운 공동구매 서비스라서',
      ],
    },
    {
      key: 'discountExpectation',
      title: '참여하고 싶은 할인 혜택',
      options: ['5%', '10%', '15%', '20%', '30% 이상'],
    },
    {
      key: 'hostIntent',
      title: '직접 호스트가 되어볼 의향',
      options: ['적극적으로 해보고 싶다', '조건이 맞으면 해보고 싶다', '참여만 하고 싶다'],
    },
    {
      key: 'preferredCategory',
      title: '가장 이용해 보고 싶은 공동구매',
      options: ['음식', '카페/음료', '마트·장보기', '과일·농산물', '생활용품'],
    },
    {
      key: 'revisitIntent',
      title: 'UPTWOYOU 재이용 의향',
      options: ['꼭 이용하고 싶다', '이용할 것 같다', '상황에 따라 이용할 것 같다', '아직 잘 모르겠다'],
    },
  ];

  return (
    <section className="screen">
      <header className="top-nav compact">
        <button className="icon-button" onClick={() => onScreen('list')} aria-label="닫기">
          <X size={22} />
        </button>
        <h1>참여 설문</h1>
        <span />
      </header>

      {surveyGroups.map((group) => (
        <div className="survey-group" key={group.key}>
          <h2>{group.title}</h2>
          {group.options.map((item) => (
            <label className="radio-row" key={item}>
              <input
                type="radio"
                checked={answer[group.key] === item}
                onChange={() => update(group.key, item)}
              />
              {item}
            </label>
          ))}
        </div>
      ))}

      <div className="form-stack compact-form">
        <label>
          피드백 및 의견
          <textarea
            value={answer.feedback}
            onChange={(event) => update('feedback', event.target.value)}
            placeholder="서비스를 이용하면서 느낀 점이나 개선 의견"
          />
        </label>
      </div>

      <button
        className="primary-button"
        onClick={() => {
          track('survey_submitted', answer);
          onScreen('list');
        }}
      >
        <Check size={18} />
        제출
      </button>
    </section>
  );
}

function OwnerApp({ screen, selectedDeal, onScreen, onCreate, onPreviewCustomer }) {
  if (screen === 'done') {
    return <OwnerDone deal={selectedDeal} onCreateAnother={() => onScreen('form')} onPreviewCustomer={onPreviewCustomer} />;
  }
  return <OwnerForm onCreate={onCreate} />;
}

function OwnerForm({ onCreate }) {
  useScreenAnalytics('owner_product_form');
  const [form, setForm] = useState({
    saleType: 'group',
    storeName: '반하다 테스트 매장',
    productName: '불고기 피자',
    category: '식사',
    description: '마감 전 함께 주문하면 할인되는 테스트 상품입니다.',
    originalPrice: 18000,
    discountRate: 15,
    stock: 10,
    maxQuantity: 20,
    deadline: '오늘 21:00',
    eventStart: '14:30',
    eventEnd: '16:00',
    pickupPlace: '매장 앞 픽업대',
    methods: ['픽업', '그룹배달'],
    image: '',
  });

  const price = discountedPrice(form.originalPrice, form.discountRate);

  const toggleMethod = (method) => {
    const methods = form.methods.includes(method)
      ? form.methods.filter((item) => item !== method)
      : [...form.methods, method];
    setForm({ ...form, methods });
  };

  const handleImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
    track('owner_image_uploaded', { file_type: file.type, size: file.size });
  };

  return (
    <section className="screen">
      <header className="top-nav">
        <div>
          <p className="eyebrow">사장님 등록</p>
          <h1>메뉴 상세</h1>
        </div>
        <Store size={22} />
      </header>

      <div className="owner-image-uploader">
        {form.image ? <img src={form.image} alt="" /> : <Upload size={38} />}
        <label className="secondary-button">
          <Upload size={18} />
          이미지 변경
          <input type="file" accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} />
        </label>
      </div>

      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const payload = { ...form, calculatedPrice: price };
          track('owner_product_created', payload);
          onCreate(payload);
        }}
      >
        <div className="content-block flush">
          <h2>판매 방식</h2>
          <div className="sale-type-grid">
            {[
              { id: 'group', title: '공동구매', body: '목표 수량 달성 시 할인' },
              { id: 'instant', title: '선착순 즉시할인', body: '재고 소진형 바로 할인' },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                className={form.saleType === item.id ? 'sale-type-card active' : 'sale-type-card'}
                onClick={() => {
                  setForm({ ...form, saleType: item.id });
                  track('sale_type_selected', { sale_type: item.id });
                }}
              >
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </button>
            ))}
          </div>
        </div>

        <label>
          매장명
          <input value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} />
        </label>
        <label>
          상품명
          <input value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} />
        </label>
        <label>
          카테고리
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option>식사</option>
            <option>카페</option>
            <option>간식</option>
            <option>편의점</option>
          </select>
        </label>
        <label>
          정상가
          <input
            type="number"
            value={form.originalPrice}
            onChange={(event) => setForm({ ...form, originalPrice: Number(event.target.value) })}
          />
        </label>
        <label>
          할인율 {form.discountRate}%
          <input
            type="range"
            min="0"
            max="70"
            value={form.discountRate}
            onChange={(event) => setForm({ ...form, discountRate: Number(event.target.value) })}
          />
        </label>
        <div className="calculated-price">
          <span>자동 계산 할인가</span>
          <strong>{formatWon(price)}</strong>
        </div>

        <div className="creator-grid">
          <FieldCounter
            label={form.saleType === 'instant' ? '재고 수량' : '재고'}
            value={form.stock}
            onMinus={() => setForm({ ...form, stock: clamp(form.stock - 1, 0, 999) })}
            onPlus={() => setForm({ ...form, stock: clamp(form.stock + 1, 0, 999) })}
          />
          {form.saleType === 'group' && (
            <FieldCounter
              label="공구 최대 수량"
              value={form.maxQuantity}
              onMinus={() => setForm({ ...form, maxQuantity: clamp(form.maxQuantity - 1, 1, 999) })}
              onPlus={() => setForm({ ...form, maxQuantity: clamp(form.maxQuantity + 1, 1, 999) })}
            />
          )}
        </div>

        <div className="content-block flush">
          <h2>수령 방식</h2>
          <div className="method-grid">
            {['배달', '픽업', '그룹배달', '택배'].map((method) => (
              <button
                type="button"
                key={method}
                className={form.methods.includes(method) ? 'method-button active' : 'method-button'}
                onClick={() => toggleMethod(method)}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <label>
          {form.saleType === 'instant' ? '선착순 즉시할인 표시 문구' : '마감 시간'}
          <input value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
        </label>
        {form.saleType === 'instant' && (
          <div className="content-block flush">
            <h2>이벤트 진행 시간</h2>
            <div className="date-time-row">
              <label>
                <Clock size={16} />
                <input
                  type="time"
                  value={form.eventStart}
                  onChange={(event) => setForm({ ...form, eventStart: event.target.value })}
                />
              </label>
              <label>
                <Clock size={16} />
                <input
                  type="time"
                  value={form.eventEnd}
                  onChange={(event) => setForm({ ...form, eventEnd: event.target.value })}
                />
              </label>
            </div>
          </div>
        )}
        <label>
          픽업 위치
          <input value={form.pickupPlace} onChange={(event) => setForm({ ...form, pickupPlace: event.target.value })} />
        </label>
        <label>
          설명
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>

        <button className="primary-button" type="submit" disabled={!form.productName || form.methods.length === 0}>
          <Check size={18} />
          상품 등록 완료
        </button>
      </form>
    </section>
  );
}

function OwnerDone({ deal, onCreateAnother, onPreviewCustomer }) {
  useScreenAnalytics('owner_product_done', { deal_id: deal.id });
  const isInstant = deal.saleType === 'instant';
  return (
    <section className="screen complete-screen">
      <div className="success-mark">
        <Check size={34} />
      </div>
      <h1>등록 완료</h1>
      <p>{deal.title} {isInstant ? '선착순 즉시할인 상품이' : '공동구매가'} 사용자 리스트에 반영되었습니다.</p>
      <img className="done-image" src={deal.image} alt="" />
      <div className="completion-summary">
        <div>
          <span>할인가</span>
          <strong>{formatWon(discountedPrice(deal.originalPrice, deal.discountRate))}</strong>
        </div>
        <div>
          <span>{isInstant ? '재고 수량' : '목표 수량'}</span>
          <strong>{deal.target}개</strong>
        </div>
      </div>
      <button className="primary-button" onClick={onPreviewCustomer}>
        <ShoppingBag size={18} />
        사용자 화면에서 보기
      </button>
      <button className="secondary-button" onClick={onCreateAnother}>
        <Plus size={18} />
        추가 등록
      </button>
    </section>
  );
}

function Dashboard({ analyticsReady }) {
  useScreenAnalytics('analytics_dashboard');
  const events = useEvents();
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(window.location.href, { width: 180, margin: 1 }).then(setQr);
  }, []);

  const stats = useMemo(() => buildStats(events), [events]);

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">User Validation / Data Validation</p>
          <h1>검증 대시보드</h1>
        </div>
        <div className={analyticsReady ? 'status-pill active' : 'status-pill'}>
          {analyticsReady ? 'PostHog 연동' : '로컬 로그 모드'}
        </div>
      </header>

      <div className="metric-grid">
        <Metric label="방문자" value={stats.visitors} />
        <Metric label="상품 등록" value={stats.ownerCreated} />
        <Metric label="상세 진입" value={stats.openListing} />
        <Metric label="참여 완료" value={stats.completed} />
        <Metric label="그룹 생성" value={stats.groupCreated} />
        <Metric label="설문 제출" value={stats.surveys} />
        <Metric label="공유 클릭" value={stats.shares} />
        <Metric label="총 이벤트" value={events.length} />
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-section">
          <div className="section-title">
            <h2>Funnel</h2>
            <button className="secondary-button compact-button" onClick={exportEventsCsv}>
              <Download size={16} />
              CSV
            </button>
          </div>
          <div className="funnel-list">
            {stats.funnel.map((stage, index) => (
              <div className="funnel-row" key={stage.label}>
                <div>
                  <span>{index + 1}</span>
                  <strong>{stage.label}</strong>
                </div>
                <div className="funnel-bar">
                  <i style={{ width: `${stage.rate}%` }} />
                </div>
                <b>{stage.count}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-title">
            <h2>화면 체류시간</h2>
          </div>
          <div className="dwell-list">
            {stats.dwell.map((row) => (
              <div key={row.screen}>
                <span>{row.screen}</span>
                <strong>{row.seconds}s</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-title">
            <h2>설문 응답</h2>
          </div>
          <div className="survey-table">
            {stats.surveyRows.length === 0 && <p className="empty-state">아직 제출된 설문이 없습니다.</p>}
            {stats.surveyRows.map((row) => (
              <div key={row.id}>
                <span>{row.reason}</span>
                <span>{row.hostIntent}</span>
                <strong>{row.revisitIntent}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section qr-section">
          <div className="section-title">
            <h2>테스트 접속</h2>
          </div>
          {qr ? <img src={qr} alt="테스트 URL QR 코드" /> : <QrCode size={80} />}
          <button
            className="secondary-button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              track('test_url_copied', {});
            }}
          >
            <Copy size={16} />
            URL 복사
          </button>
        </div>
      </div>
    </section>
  );
}

function EventMonitor({ analyticsReady }) {
  const events = useEvents();
  const recent = events.slice(-8).reverse();

  return (
    <aside className="event-monitor">
      <div className="monitor-header">
        <div>
          <p className="eyebrow">Tracking</p>
          <h2>이벤트 로그</h2>
        </div>
        <span className={analyticsReady ? 'dot active' : 'dot'} />
      </div>

      <div className="visitor-box">
        <span>익명 ID</span>
        <code>{getVisitorId().slice(0, 18)}...</code>
      </div>

      <div className="monitor-actions">
        <button className="secondary-button compact-button" onClick={exportEventsCsv}>
          <Download size={16} />
          CSV
        </button>
        <button className="ghost-button" onClick={clearEvents}>
          초기화
        </button>
      </div>

      <div className="event-list">
        {recent.length === 0 && <p className="empty-state">이벤트가 쌓이면 여기에 표시됩니다.</p>}
        {recent.map((event) => (
          <div key={event.id} className="event-row">
            <strong>{event.name}</strong>
            <span>{new Date(event.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>

      <div className="definition-list">
        <h3>이벤트 정의</h3>
        {eventDefinitions.map((event) => (
          <div key={event.name}>
            <span>{event.label}</span>
            <code>{event.name}</code>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Progress({ current, target }) {
  const rate = clamp(Math.round((current / target) * 100), 0, 100);
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>참여 {current}명</span>
        <strong>목표 {target}명</strong>
      </div>
      <div className="progress-bar">
        <i style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function Counter({ value, onMinus, onPlus }) {
  return (
    <div className="counter">
      <button type="button" onClick={onMinus} aria-label="감소">
        <Minus size={14} />
      </button>
      <strong>{value}</strong>
      <button type="button" onClick={onPlus} aria-label="증가">
        <Plus size={14} />
      </button>
    </div>
  );
}

function FieldCounter({ label, value, onMinus, onPlus }) {
  return (
    <div className="field-counter">
      <span>{label}</span>
      <Counter value={value} onMinus={onMinus} onPlus={onPlus} />
    </div>
  );
}

function BottomNav({ active, onSelect }) {
  const items = [
    { id: 'home', screen: 'list', label: '홈', icon: Home },
    { id: 'explore', screen: 'explore', label: '탐색', icon: Users },
    { id: 'orders', screen: 'orders', label: '내 주문', icon: ShoppingBag },
    { id: 'favorites', screen: 'favorites', label: '찜', icon: Heart },
    { id: 'profile', screen: 'profile', label: '마이', icon: User },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(({ id, screen, label, icon: Icon }) => (
        <button
          key={id}
          className={active === id ? 'active' : ''}
          onClick={() => {
            track('bottom_tab_clicked', { tab: id });
            onSelect(screen);
          }}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function useEvents() {
  const [events, setEvents] = useState(() => getEvents());

  useEffect(() => {
    const update = () => setEvents(getEvents());
    window.addEventListener('o2o-events-updated', update);
    return () => window.removeEventListener('o2o-events-updated', update);
  }, []);

  return events;
}

function buildStats(events) {
  const unique = (predicate) => new Set(events.filter(predicate).map((event) => event.visitorId)).size;
  const visitors = new Set(events.map((event) => event.visitorId)).size;
  const funnelSeed = Math.max(1, unique((event) => event.name === 'screen_view' && event.properties.screen === 'deal_list'));
  const funnel = [
    { label: '리스트 방문', count: unique((event) => event.name === 'screen_view' && event.properties.screen === 'deal_list') },
    { label: '상세 진입', count: unique((event) => event.name === 'open_listing') },
    { label: '참여 시작', count: unique((event) => event.name === 'join_started') },
    { label: '참여 완료', count: unique((event) => event.name === 'purchase_completed') },
    { label: '설문 제출', count: unique((event) => event.name === 'survey_submitted') },
  ].map((stage) => ({ ...stage, rate: Math.round((stage.count / funnelSeed) * 100) }));

  const dwellMap = events
    .filter((event) => event.name === 'screen_dwell')
    .reduce((acc, event) => {
      const screen = event.properties.screen;
      acc[screen] = acc[screen] || [];
      acc[screen].push(event.properties.dwell_ms || 0);
      return acc;
    }, {});

  const dwell = Object.entries(dwellMap)
    .map(([screen, values]) => ({
      screen,
      seconds: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 1000),
    }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 6);

  const surveyRows = events
    .filter((event) => event.name === 'survey_submitted')
    .slice(-5)
    .map((event) => ({
      id: event.id,
      reason: event.properties.reason,
      hostIntent: event.properties.hostIntent,
      revisitIntent: event.properties.revisitIntent,
    }));

  return {
    visitors,
    ownerCreated: events.filter((event) => event.name === 'owner_product_created').length,
    openListing: events.filter((event) => event.name === 'open_listing').length,
    completed: events.filter((event) => event.name === 'purchase_completed').length,
    groupCreated: events.filter((event) => event.name === 'group_created').length,
    surveys: events.filter((event) => event.name === 'survey_submitted').length,
    shares: events.filter((event) => event.name === 'share_clicked').length,
    funnel,
    dwell,
    surveyRows,
  };
}

export default App;
