
import React, { Component } from 'react'
import { Link } from 'react-router'
import cn from 'classnames'

import { hideLoader } from 'lib/loader'
import Button from 'components/Button'

import { setTitle } from 'containers/App'
import style from './style.scss'

export default class TermsOfUsage extends Component {
  constructor(props) {
    super(props)

    this.state = {
    }
  }

  componentDidMount() {
    setTitle('Terms of Use')

    hideLoader()
  }

  render() {
    return (
      <div className={style.rootContainer}>
        <div className={style.rootContentContainer}>
          <img className={style.logo} src="/logo.svg" />
            <div className={style.text}>
              <h1>Terms and Privacy</h1>
              <p>No individual under the age of eighteen (18) may use VgoCrush, regardless of any consent from a parent or guardian to use VgoCrush. </p>
              <p>You need a supported Web browser to access VgoCrush. You acknowledge and agree that VgoCrush may cease to support a given Web browser and that your continuous use of VgoCrush will require you to download a supported Web browser. You also acknowledge and agree that the performance of VgoCrush is incumbent on the performance of your computer equipment and your Internet connection. </p>
              <p>You agree to sign on and register for VgoCrush through your Steam account provided by Valve Corporation. You are solely responsible for managing your account and password and for keeping your password confidential. You are also solely responsible for restricting access to your account. </p>
              <p>You agree that you are responsible for all activities that occur on your account or through the use of your password by yourself or by other persons. If you believe that a third party has access your password, use the password regeneration feature of VgoCrush as soon as possible to obtain a new password. In all circumstances, you agree not to permit any third party to use or access VgoCrush. </p>
              <p>As a condition to your use of VgoCrush, you agree not to: </p>
              <ul>
                <li>(a) impersonate or misrepresent your affiliation with any person or entity; </li>
                <li>(b) access, tamper with, or use any non-public areas of VgoCrush or VgoCrush's computer systems; </li>
                <li>(c) attempt to probe, scan, or test the vulnerability of VgoCrush or any related system or network or breach any security or authentication measures used in connection with VgoCrush and such systems and networks; </li>
                <li>(d) attempt to decipher, decompile, disassemble, reverse engineer or otherwise investigate any of the software or components used to provide VgoCrush; </li>
                <li>(e) harm or threaten to harm other users in any way or interfere with, or attempt to interfere with, the access of any user, host or network, including without limitation, by sending a virus, overloading, flooding, spamming, or mail-bombing VgoCrush; </li>
                <li>(f) provide payment information belonging to a third party; </li>
                <li>(g) use VgoCrush in an abusive way contrary to its intended use, to VgoCrush's policies and instructions and to any applicable law; </li>
                <li>(h) systematically retrieve data or other content from VgoCrush to create or compile, directly or indirectly, in single or multiple downloads, a collection, compilation, database, directory or the like, whether by manual methods, through the use of bots, crawlers, or spiders, or otherwise; </li>
                <li>(i) make use of VgoCrush in a manner contrary to the terms and conditions under which third parties provide facilities and technology necessary for the operation of VgoCrush, such as PAYPAL or VALVE CORP;</li>
                <li>(j) infringe third party intellectual property rights when using or accessing VgoCrush, including but not limited to in making available virtual items by using VgoCrush; </li>
                <li>and (k) make use of, promote, link to or provide access to materials deemed by VgoCrush at its sole discretion to be offensive or cause harm to VgoCrush’s reputation, including, but not limited to, illegal content and pornographic content and content deemed offensive or injurious to VgoCrush (such as Warez sites, IRC bots and bittorent sites). </li>
              </ul>
              <h2>Termination</h2>
              <p>We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms of Service. </p>
              <p>All provisions of the Terms of Service which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity and limitations of liability.</p>
              <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms of Service. </p>
              <p>Upon termination, your right to use VgoCrush will immediately cease. If you wish to terminate your account, you may simply do so by discontinuing your use of VgoCrush. </p>
              <h2>Links To Other Web Sites</h2>
              <p>Our Service may contain links to third-party web sites or services that are not owned or controlled by VgoCrush. </p>
              <p>VgoCrush has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third party web sites or services. You further acknowledge and agree that VgoCrush shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content, goods or services available on or through any such web sites or services. </p>
              <p>We strongly advise you to read the terms and conditions and privacy policies of any third-party web sites or services that you visit. </p>
              <h2>No warranties </h2>
              <p>This website is provided “as is” without any representations or warranties, express or implied. This website makes no representations or warranties in relation to this website or the information and materials provided on this website. Without prejudice to the generality of the foregoing paragraph, www.VgoCrush.com does not warrant that: this website will be constantly available, or available at all; or the information on this website is complete, true, accurate or non-misleading. Nothing on this website constitutes, or is meant to constitute, advice of any kind. If you require advice in relation to any legal, financial or medical matter you should consult an appropriate professional. </p>
              <h2>Affiliation </h2>
              <p>We are in NO WAY affiliated with or endorsed by the Valve corporation, Counter Strike: Global Offensive, Steam or any other trademarks of the Valve corporation.</p>
              <h2>VgoCrush Inventory </h2>
              <p>By topping up your inventory, you agree that there are no refunds & that you must bet at least 75% of the deposited amount in order to withdraw.</p>
              <h2>Returns and Refunds Policy </h2>
              <p>We do not issue refunds for digital products once the order is confirmed and the product is sent. We recommend contacting us for assistance if you experience any issues receiving or downloading our products. </p>
              <h2>UI / Interface errors</h2>
              <p>Interfaces glitches/manipulation in no way entitles the user to a certain item. All outcomes are generated by our provably fair system and awarded as such. The user agrees that the outcome will be determined by the provably fair system outcome and any user interface errors do not entitle the user to that item. </p>
              <h2>Suspicious activity</h2>
              <p>If we identify suspicious activity such as using more than 1 PayPal e-mail with your account, using an invalid account or clonned credit card, we may ask you to provide documents to confirm authenticity of your PayPal account before we clear your purchases. </p>
              <h2>Bots and Steam API </h2>
              <p>The trade offer request sent by our bots are subject to Steam Guard authentication and the buyer must have Steam Guard activated for at least 15 days on their smartphone so the trade is completed. Note that this is a Steam restriction. The skins won't expire but the user needs to wait for that period to end. </p>
              <h2>How we use cookies</h2>
              <p>A cookie is a small file which asks permission to be placed on your computer's hard drive. Once you agree, the file is added and the cookie helps analyze web traffic or lets you know when you visit a particular site. Cookies allow web applications to respond to you as an individual. The web application can tailor its operations to your needs, likes and dislikes by gathering and remembering information about your preferences.</p>
              <p>We use traffic log cookies to identify which pages are being used. This helps us analyze data about webpage traffic and improve our website in order to tailor it to customer needs. We only use this information for statistical analysis purposes and then the data is removed from the system.</p>
              <p>Overall, cookies help us provide you with a better website, by enabling us to monitor which pages you find useful and which you do not. A cookie in no way gives us access to your computer or any information about you, other than the data you choose to share with us. You can choose to accept or decline cookies. Most web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. This may prevent you from taking full advantage of the website.</p>
              <h2>Security</h2>
              <p>We are committed to ensuring that your information is secure. In order to prevent unauthorized access or disclosure, we have put in place suitable physical, electronic and managerial procedures to safeguard and secure the information we collect online.</p>
              <h2>Changes to the Terms of Use</h2>
              <p>We may revise and update these Terms of service from time to time in our sole discretion. All changes are effective immediately when we post them, and apply to all access to and use of the Website thereafter. However, any changes to the dispute resolution provisions set forth in Governing Law and Jurisdiction will not apply to any disputes for which the parties have actual notice on or prior to the date the change is posted on the Website.</p>
              <p>Your continued use of the Website following the posting of revised Terms of service means that you accept and agree to the changes. You are expected to check this page from time to time so you are aware of any changes, as they are binding on you.</p>
          </div>
        </div>
      </div>
    )
  }
}
