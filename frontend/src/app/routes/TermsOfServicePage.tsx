import { Link } from 'react-router-dom'
import { paths } from '../paths'

// TODO: 運営者名・連絡先メールアドレス・裁判所名・制定日は仮の値です。公開前に実際の情報へ差し替えてください。
const OPERATOR_NAME = '【運営者名・チーム名】'
const CONTACT_EMAIL = '【連絡先メールアドレス】'
const COURT_NAME = '【裁判所名】'
const ENACTED_ON = '【20XX年XX月XX日】'

const sectionTitleClass = 'mt-10 mb-3 text-lg font-bold text-[#193b38] first:mt-0'
const bodyTextClass = 'mb-3 text-[14px] leading-[1.9] text-[#4b5551]'
const listClass = 'mb-3 list-disc space-y-1.5 pl-5 text-[14px] leading-[1.9] text-[#4b5551] marker:text-[#53a283]'
const orderedListClass = 'mb-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-[1.9] text-[#4b5551] marker:text-[#53a283]'

export function TermsOfServicePage() {
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
          利用規約
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
          本利用規約（以下「本規約」といいます）は、{OPERATOR_NAME}
          （以下「当方」といいます）が提供するウォーキング・街づくりアプリケーション「Walk
          City」（以下「本サービス」といいます）の利用条件を定めるものです。ユーザーの皆さま（以下「ユーザー」といいます）には、本規約に従って本サービスをご利用いただきます。
        </p>
        <p className={bodyTextClass}>
          なお、本サービスにおける情報の取り扱いについては、別途定める
          <Link className="text-[#438c76] underline" to={paths.privacy}>
            プライバシーポリシー
          </Link>
          にも従うものとします。
        </p>

        <h2 className={sectionTitleClass}>第1条（適用）</h2>
        <p className={bodyTextClass}>
          本規約は、ユーザーと当方との間の本サービスの利用に関わる一切の関係に適用されます。ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。
        </p>

        <h2 className={sectionTitleClass}>第2条（定義）</h2>
        <p className={bodyTextClass}>本規約において使用する用語の意味は、次のとおりとします。</p>
        <ul className={listClass}>
          <li>「街（タウン）」：ユーザーが本サービス上で保有・編集する仮想の街のデータをいいます。</li>
          <li>
            「コイン」：本サービス内でのみ使用できる仮想的なポイントであり、歩数の精算等により付与されます。
          </li>
          <li>
            「Google Health連携」：ユーザーの選択により、Google Health
            APIを通じて日次歩数を取得する機能をいいます。
          </li>
        </ul>

        <h2 className={sectionTitleClass}>第3条（アカウント登録・ログイン）</h2>
        <ol className={orderedListClass}>
          <li>本サービスの利用には、Googleアカウントを用いたログインが必要です。</li>
          <li>
            ユーザーは、自己の責任においてGoogleアカウントを適切に管理するものとし、当方は、ユーザーのGoogleアカウントの管理不十分、使用上の過誤、第三者の使用等によって生じた損害について、当方に故意または重大な過失がある場合を除き、責任を負いません。
          </li>
          <li>
            当方は、ユーザーが次の各号のいずれかに該当すると判断した場合、ログインまたは登録を拒否することがあります。
            <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-[#53a283]">
              <li>虚偽の情報を届け出た場合</li>
              <li>過去に本規約への違反等により利用制限を受けたことがある場合</li>
              <li>反社会的勢力等である、または関与していると当方が判断した場合</li>
              <li>その他、当方が登録を適当でないと判断した場合</li>
            </ul>
          </li>
        </ol>

        <h2 className={sectionTitleClass}>第4条（Google Health連携について）</h2>
        <ol className={orderedListClass}>
          <li>Google Health連携は任意の機能であり、ユーザーはいつでも連携を許可・解除できます。</li>
          <li>
            本サービスが取得・利用する歩数データの範囲は、
            <Link className="text-[#438c76] underline" to={paths.privacy}>
              プライバシーポリシー
            </Link>
            に定めるとおりとします。
          </li>
          <li>
            歩数データの正確性は、連携元であるGoogle
            Healthおよびユーザーが使用する記録元デバイス・アプリの仕様に依存します。当方は、歩数データの欠落、遅延、誤差について保証しません。
          </li>
        </ol>

        <h2 className={sectionTitleClass}>第5条（コイン・街データの取り扱い）</h2>
        <ol className={orderedListClass}>
          <li>
            コインおよび街のデータは、本サービス内でのみ利用できるものであり、現金、金銭的価値のあるものその他の経済的価値と交換・換金することはできません。
          </li>
          <li>コインおよび街のデータの譲渡、貸与、売買その他の第三者への移転は禁止します。</li>
          <li>
            当方は、システム上の都合、不正の防止、その他の合理的な理由がある場合、事前の通知なくコインの残高または街のデータを調整・削除することがあります。
          </li>
          <li>
            当方は、当方の判断により、コインの付与条件、建物・道路の仕様、土地開放の条件その他本サービスのゲーム内容を変更することがあります。
          </li>
        </ol>

        <h2 className={sectionTitleClass}>第6条（禁止事項）</h2>
        <p className={bodyTextClass}>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ol className={orderedListClass}>
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>
            当方、他のユーザーまたは第三者の知的財産権、肖像権、プライバシー、名誉その他の権利または利益を侵害する行為
          </li>
          <li>
            歩数データを改ざんする行為、または不正なツール・自動化された手段等により歩数・コインを不正に取得する行為
          </li>
          <li>本サービスのサーバーまたはネットワークシステムに過度な負荷をかける行為</li>
          <li>本サービスの運営を妨害するおそれのある行為</li>
          <li>不正アクセスをし、またはこれを試みる行為</li>
          <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
          <li>
            他のユーザーになりすます行為、またはユーザー名・街名等に第三者の権利を侵害する表現、公序良俗に反する表現、他者を誤認させる表現を用いる行為
          </li>
          <li>
            本サービスの内容を無断で複製、改変、リバースエンジニアリング、逆コンパイルまたは逆アセンブルする行為
          </li>
          <li>反社会的勢力に対する利益供与その他の協力行為</li>
          <li>その他、当方が不適切と判断する行為</li>
        </ol>

        <h2 className={sectionTitleClass}>第7条（本サービスの提供の停止・中断）</h2>
        <p className={bodyTextClass}>
          当方は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができます。
        </p>
        <ol className={orderedListClass}>
          <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
          <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
          <li>コンピュータまたは通信回線等が事故により停止した場合</li>
          <li>外部サービス（Google、Supabase等）における障害、仕様変更または提供終了があった場合</li>
          <li>その他、当方が本サービスの提供が困難と判断した場合</li>
        </ol>
        <p className={bodyTextClass}>
          当方は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益または損害についても、一切の責任を負わないものとします。
        </p>

        <h2 className={sectionTitleClass}>第8条（利用制限および登録抹消）</h2>
        <p className={bodyTextClass}>
          当方は、ユーザーが以下のいずれかに該当する場合には、事前の通知なく、ユーザーに対して本サービスの全部もしくは一部の利用を制限し、またはアカウントを削除することができるものとします。
        </p>
        <ol className={orderedListClass}>
          <li>本規約のいずれかの条項に違反した場合</li>
          <li>登録事項に虚偽の事実があることが判明した場合</li>
          <li>その他、当方が本サービスの利用を適当でないと判断した場合</li>
        </ol>
        <p className={bodyTextClass}>
          当方は、本条に基づき当方が行った行為によりユーザーに生じた損害について、一切の責任を負いません。
        </p>

        <h2 className={sectionTitleClass}>第9条（退会）</h2>
        <p className={bodyTextClass}>
          ユーザーは、第13条に定める窓口を通じて、当方所定の手続によりいつでも本サービスから退会（アカウントの削除）できるものとします。退会した場合、街のデータ、コイン残高その他保存されていた情報は失われ、復旧できません。
        </p>

        <h2 className={sectionTitleClass}>第10条（保証の否認・免責事項）</h2>
        <ol className={orderedListClass}>
          <li>
            当方は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しません。
          </li>
          <li>
            当方は、本サービスに起因してユーザーに生じたあらゆる損害について、当方の故意または重過失による場合を除き、一切の責任を負いません。
          </li>
          <li>
            前項ただし書に定める場合であっても、当方は、当方の過失（重過失を除きます）による債務不履行または不法行為によりユーザーに生じた損害のうち、特別な事情から生じた損害（当方またはユーザーが損害発生につき予見し、または予見し得た場合を含みます）について一切の責任を負いません。
          </li>
          <li>
            本サービスに関してユーザーと他のユーザーまたは第三者との間において生じた取引、連絡、紛争等については、ユーザーの責任で解決するものとし、当方は一切の責任を負いません。
          </li>
        </ol>

        <h2 className={sectionTitleClass}>第11条（サービス内容の変更等）</h2>
        <p className={bodyTextClass}>
          当方は、ユーザーへの事前の通知なく、本サービスの内容を変更、追加または廃止することがあり、ユーザーはこれを承諾するものとします。
        </p>

        <h2 className={sectionTitleClass}>第12条（利用規約の変更）</h2>
        <ol className={orderedListClass}>
          <li>当方は、必要と判断した場合には、ユーザーへの事前の通知なく本規約を変更することができるものとします。</li>
          <li>
            変更後の利用規約は、当方が別途定める場合を除いて、本サービス上に掲示した時点より効力を生じるものとします。
          </li>
        </ol>

        <h2 className={sectionTitleClass}>第13条（通知または連絡・お問い合わせ窓口）</h2>
        <p className={bodyTextClass}>
          本サービスに関するお問い合わせ、退会のご希望その他ユーザーと当方との間の通知または連絡は、以下の窓口までご連絡ください。
        </p>
        <div className="mb-3 rounded-xl border border-[#dedfd7] bg-white p-5 text-[14px] text-[#4b5551]">
          <p className="mb-1">
            運営者：<b className="text-[#193b38]">{OPERATOR_NAME}</b>
          </p>
          <p className="m-0">
            連絡先：<b className="text-[#193b38]">{CONTACT_EMAIL}</b>
          </p>
        </div>

        <h2 className={sectionTitleClass}>第14条（権利義務の譲渡の禁止）</h2>
        <p className={bodyTextClass}>
          ユーザーは、当方の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。
        </p>

        <h2 className={sectionTitleClass}>第15条（準拠法・裁判管轄）</h2>
        <ol className={orderedListClass}>
          <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
          <li>
            本サービスに関して紛争が生じた場合には、{COURT_NAME}
            を第一審の専属的合意管轄裁判所とします。
          </li>
        </ol>
      </article>
    </main>
  )
}
