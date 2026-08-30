import { Link } from 'react-router-dom'
import { paths } from '../paths'

// TODO: 運営者名・連絡先メールアドレス・制定日は仮の値です。公開前に実際の情報へ差し替えてください。
const OPERATOR_NAME = '【運営者名・チーム名】'
const CONTACT_EMAIL = '【連絡先メールアドレス】'
const ENACTED_ON = '【20XX年XX月XX日】'

const sectionTitleClass = 'mt-10 mb-3 text-lg font-bold text-[#193b38] first:mt-0'
const subTitleClass = 'mt-5 mb-2 text-sm font-bold text-[#193b38]'
const bodyTextClass = 'mb-3 text-[14px] leading-[1.9] text-[#4b5551]'
const listClass = 'mb-3 list-disc space-y-1.5 pl-5 text-[14px] leading-[1.9] text-[#4b5551] marker:text-[#53a283]'

export function PrivacyPolicyPage() {
  return (
    <main className="min-h-svh bg-[#f7f6f0]">
      <header className="flex min-h-[76px] items-center justify-between px-[clamp(20px,5vw,72px)]">
        <Link
          className="flex items-center gap-3 text-[15px] font-extrabold tracking-[-.02em] text-[#0b302f] no-underline"
          to={paths.login}
        >
          <span className="inline-grid h-9 w-9 place-items-center rounded-[11px_11px_11px_3px] bg-[#ffcf57] text-lg font-black text-[#0b2d2b] shadow-[inset_0_-2px_0_rgba(0,0,0,.12)]">
            W
          </span>
          <span>Walk City</span>
        </Link>
        <Link
          className="text-xs font-bold text-[#438c76] no-underline hover:underline"
          to={paths.login}
        >
          ← ログインへ戻る
        </Link>
      </header>

      <article className="mx-auto w-[min(100%,720px)] px-[clamp(20px,5vw,32px)] pt-6 pb-24">
        <span className="mb-3 block text-xs font-extrabold tracking-[.19em] text-[#438c76]">
          WALK CITY / LEGAL
        </span>
        <h1 className="m-0 text-[clamp(28px,4vw,38px)] leading-[1.2] tracking-[-.03em] text-[#102f2d]">
          プライバシーポリシー
        </h1>
        <p className="mt-3 mb-10 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#858b88]">
          <span>
            対象プロダクト：<b className="text-[#4b5551]">Walk City</b>
          </span>
          <span>
            制定日：<b className="text-[#4b5551]">{ENACTED_ON}</b>
          </span>
        </p>

        <p className={bodyTextClass}>
          {OPERATOR_NAME}
          （以下「当方」といいます）は、当方が提供するウォーキング・街づくりアプリケーション「Walk
          City」（以下「本サービス」といいます）における、ユーザーの情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
        </p>

        <h2 className={sectionTitleClass}>第1条（適用）</h2>
        <p className={bodyTextClass}>
          本ポリシーは、本サービスの利用に関して、当方とユーザーとの間に適用されます。ユーザーは、本サービスを利用することにより、本ポリシーに同意したものとみなされます。
        </p>

        <h2 className={sectionTitleClass}>第2条（取得する情報）</h2>
        <p className={bodyTextClass}>本サービスは、ユーザーから以下の情報を取得します。</p>

        <h3 className={subTitleClass}>1. アカウント情報（Googleログイン）</h3>
        <p className={bodyTextClass}>
          本サービスは Supabase Authentication を通じた Google
          アカウントでのログインのみを提供します。ログイン時、Google から以下の情報を取得します。
        </p>
        <ul className={listClass}>
          <li>メールアドレス</li>
          <li>表示名・プロフィール画像（Googleアカウントに設定されている場合）</li>
          <li>Googleアカウントの識別子（内部的なユーザーIDの発行に使用）</li>
        </ul>
        <p className={bodyTextClass}>
          パスワードなどの認証情報そのものは、当方のサーバーには保存されません。
        </p>

        <h3 className={subTitleClass}>2. 歩数データ（Google Health連携。任意・オプトイン）</h3>
        <p className={bodyTextClass}>
          ユーザーが本サービス上で明示的に「Google Health連携」を許可した場合に限り、Google
          Health API の読み取り専用スコープ（
          <code className="rounded bg-[#eceae0] px-1.5 py-0.5 text-[13px]">
            googlehealth.activity_and_fitness.readonly
          </code>
          ）を通じて、日次の合計歩数のみを取得します。
        </p>
        <ul className={listClass}>
          <li>
            取得するのは歩数（
            <code className="rounded bg-[#eceae0] px-1.5 py-0.5 text-[13px]">
              steps.countSum
            </code>
            ）のみで、心拍数・睡眠・位置情報などその他の健康データは取得しません。
          </li>
          <li>Google Healthへの書き込みは行いません。</li>
          <li>連携を許可しない場合でも、ログインを含む本サービスの他の機能は利用できます。</li>
          <li>連携はユーザーの操作によりいつでも解除できます（第10条）。</li>
        </ul>

        <h3 className={subTitleClass}>3. ユーザーが作成するコンテンツ</h3>
        <p className={bodyTextClass}>
          本サービスの利用にあたり、ユーザー自身が入力・作成する以下の情報を保存します。
        </p>
        <ul className={listClass}>
          <li>ユーザー名（表示名）</li>
          <li>街（タウン）の名称</li>
          <li>街の建物・道路の配置データ</li>
          <li>歩数から精算されたコインの残高・獲得履歴</li>
        </ul>

        <h3 className={subTitleClass}>4. Cookie・ローカルストレージ等</h3>
        <p className={bodyTextClass}>
          ログイン状態を維持するため、Supabase
          Authenticationが発行するセッション情報をブラウザのローカルストレージ等に保存します。広告配信を目的としたトラッキングCookieは使用しません。
        </p>

        <h3 className={subTitleClass}>5. アクセスログ等</h3>
        <p className={bodyTextClass}>
          本サービスの提供基盤（ホスティング事業者・データベース事業者）が、不正利用防止やサービス運用のため、IPアドレス、アクセス日時、ブラウザ情報などの技術的なログを自動的に記録する場合があります。
        </p>

        <h2 className={sectionTitleClass}>第3条（利用目的）</h2>
        <p className={bodyTextClass}>取得した情報は、以下の目的で利用します。</p>
        <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-[1.9] text-[#4b5551] marker:text-[#53a283]">
          <li>本サービスへのログイン認証、本人確認</li>
          <li>Google Healthの歩数データに基づくコインの精算、街への反映</li>
          <li>ユーザー名・街名・人口ランキング等、ユーザーが公開を意図した情報の表示（第6条）</li>
          <li>不具合の調査、本サービスの維持・改善</li>
          <li>不正利用・規約違反への対応</li>
          <li>ユーザーからのお問い合わせへの対応</li>
          <li>本ポリシーまたは利用規約の変更等、重要な通知の送付</li>
        </ol>
        <p className={bodyTextClass}>取得した情報を、上記の目的以外で利用することはありません。</p>

        <h2 className={sectionTitleClass}>第4条（第三者提供）</h2>
        <p className={bodyTextClass}>
          当方は、以下の場合を除き、ユーザーの個人情報を本人の同意なく第三者に提供しません。
        </p>
        <ul className={listClass}>
          <li>法令に基づく場合</li>
          <li>
            人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき
          </li>
          <li>国の機関等が法令の定める事務を遂行することに対して協力する必要がある場合</li>
        </ul>

        <h2 className={sectionTitleClass}>第5条（外部サービスの利用）</h2>
        <p className={bodyTextClass}>
          本サービスは、機能の提供にあたり以下の外部サービスを利用しています。各サービスにおけるデータの取り扱いは、各社のプライバシーポリシーにも従います。
        </p>
        <div className="mb-4 overflow-x-auto rounded-xl border border-[#dedfd7]">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#eceae0] text-left text-[#66706d]">
                <th className="px-4 py-2.5 font-bold">サービス</th>
                <th className="px-4 py-2.5 font-bold">用途</th>
                <th className="px-4 py-2.5 font-bold">主なデータの流れ</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-[#dedfd7] [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-[#4b5551]">
              <tr>
                <td>Google（Googleログイン / Google Health API）</td>
                <td>ログイン認証、歩数データの読み取り</td>
                <td>ログイン情報・歩数データの取得元</td>
              </tr>
              <tr>
                <td>Supabase</td>
                <td>認証基盤、データベース、Edge Functionsによるサーバー処理</td>
                <td>
                  アカウント情報・街のデータ・（暗号化した）Google Healthの更新トークンの保存先
                </td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>本サービスのフロントエンドのホスティング</td>
                <td>アクセスログ等の技術情報の処理</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={bodyTextClass}>
          Google Healthの更新トークンおよびクライアントシークレットはブラウザに送信せず、Supabase
          Edge Function経由でのみ扱い、外部からアクセスできないデータベース領域に暗号化して保存しています。
        </p>

        <h3 className={subTitleClass}>Google API Services User Data Policyの遵守</h3>
        <p className={bodyTextClass}>
          Walk CityによるGoogleユーザーデータの使用および他アプリへの転送は、
          <a
            className="text-[#438c76] underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          （Limited Use要件を含む）を遵守します。
        </p>

        <h2 className={sectionTitleClass}>第6条（公開される情報の範囲）</h2>
        <p className={bodyTextClass}>
          本サービスは、他のユーザーが「ランキング」および「街ページ」機能を通じて、以下の情報のみを閲覧できる仕様です。
        </p>
        <ul className={listClass}>
          <li>ユーザー名（表示名）</li>
          <li>街の名称</li>
          <li>街の人口（建物の配置状況から算出される数値）</li>
          <li>街の見た目（建物・道路の配置）</li>
        </ul>
        <p className={bodyTextClass}>
          以下の情報は、公開街・ランキングを含むいかなる画面でも他のユーザーには表示されません。
        </p>
        <ul className={listClass}>
          <li>メールアドレス</li>
          <li>コイン残高・獲得履歴</li>
          <li>歩数データ</li>
          <li>Google Health連携の有無・状態</li>
        </ul>

        <h2 className={sectionTitleClass}>第7条（Cookie等の使用目的）</h2>
        <p className={bodyTextClass}>
          本サービスが使用するCookie・ローカルストレージは、ログイン状態の維持など本サービスの機能提供に必要な範囲でのみ使用します。広告配信事業者との連携や、第三者による行動ターゲティング広告のためのトラッキングは行いません。
        </p>

        <h2 className={sectionTitleClass}>第8条（安全管理措置）</h2>
        <p className={bodyTextClass}>
          当方は、取得した情報の漏えい、滅失またはき損の防止その他の安全管理のため、以下を含む必要かつ適切な措置を講じます。
        </p>
        <ul className={listClass}>
          <li>
            Google Healthの更新トークンの暗号化、およびアプリケーションから直接到達できないデータベース領域（privateスキーマ）での管理
          </li>
          <li>通信の暗号化（HTTPS）</li>
          <li>Supabaseの認証・認可の仕組みによるアクセス制御</li>
        </ul>

        <h2 className={sectionTitleClass}>第9条（保有期間・削除）</h2>
        <p className={bodyTextClass}>
          ユーザーの情報は、アカウントが存在する間、第3条の目的のために保有します。アカウントの削除、または保存されている情報の削除を希望する場合は、第13条のお問い合わせ窓口までご連絡ください。合理的な期間内に確認のうえ対応します。
        </p>

        <h2 className={sectionTitleClass}>第10条（Google Health連携の解除）</h2>
        <p className={bodyTextClass}>
          ユーザーは、本サービスの設定画面からGoogle
          Health連携をいつでも解除できます。解除後、当方は歩数データの新規取得を停止します。Google側のアカウント設定から本サービスへのアクセス許可を取り消すことも可能です。
        </p>

        <h2 className={sectionTitleClass}>第11条（未成年者の利用について）</h2>
        <p className={bodyTextClass}>
          未成年者が本サービスを利用する場合は、あらかじめ保護者の同意を得たうえでご利用ください。
        </p>

        <h2 className={sectionTitleClass}>第12条（免責事項）</h2>
        <p className={bodyTextClass}>
          本サービスは、歩数の記録・街づくりを目的としたものであり、医療・健康に関する助言を提供するものではありません。歩数データの精度は、連携元であるGoogle
          Healthの仕様に依存します。
        </p>

        <h2 className={sectionTitleClass}>
          第13条（開示・訂正・利用停止等の請求、お問い合わせ窓口）
        </h2>
        <p className={bodyTextClass}>
          本サービスにおけるユーザーの情報について、開示、訂正、削除、利用停止等を希望される場合、または本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。
        </p>
        <div className="mb-3 rounded-xl border border-[#dedfd7] bg-white p-5 text-[14px] text-[#4b5551]">
          <p className="mb-1">
            運営者：<b className="text-[#193b38]">{OPERATOR_NAME}</b>
          </p>
          <p className="m-0">
            連絡先：<b className="text-[#193b38]">{CONTACT_EMAIL}</b>
          </p>
        </div>

        <h2 className={sectionTitleClass}>第14条（本ポリシーの変更）</h2>
        <p className={bodyTextClass}>
          当方は、必要に応じて本ポリシーの内容を変更することがあります。変更後のポリシーは、本サービス上に掲載した時点から効力を生じるものとします。重要な変更を行う場合は、本サービス上での掲示その他の適切な方法で周知します。
        </p>

        <h2 className={sectionTitleClass}>第15条（準拠法）</h2>
        <p className={bodyTextClass}>
          本ポリシーの解釈にあたっては、日本法を準拠法とします。
        </p>
      </article>
    </main>
  )
}
