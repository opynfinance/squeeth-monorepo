import { createStyles, makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    policySubText: {
      color: '#2ce6f9',
      fontWeight: 600,
    },
    listItem: {
      scrollMarginTop: '100px',
    },
    tableStyle: { border: '1px solid #fff', padding: '.5em' },
    tableContainer: {
      display: 'block',
      maxWidth: '100%',
      margin: '0 auto',
      overflowX: 'auto',

      [theme.breakpoints.down('xs')]: {
        whiteSpace: 'nowrap',
      },
    },
    links: {
      color: '#2ce6f9',
      '&:hover,&:focus': {
        textDecoration: 'underline',
      },
    },
    disablingListItems: {
      marginBottom: '.75em',
    },
  }),
)

const CookiePolicy = () => {
  const classes = useStyles()
  return (
    <section>
      <h1>The Opyn Cookie Policy</h1>
      <h3> Last Updated: May 16, 2022</h3>
      <p>
        This Cookie Policy explains how we use cookies and similar tracking methods when you visit the Interface, as
        defined within the Opyn User Terms of Service (“User Terms”).
      </p>
      <p>
        This policy explains what various tracking methods are and why they are used. It also explains your right to
        control their use.
      </p>
      <p>
        We may change this Cookie Policy at any time. Check the “last updated” date at the top of this page to see when
        this Cookie Policy was last revised. Any change becomes effective when we post the revised Cookie Policy on or
        through our Interface. If you have any questions, please contact us by email at{' '}
        <a className={classes.links} href="mailto: legal@opyn.co">
          legal@opyn.co
        </a>
        .
      </p>

      <ol>
        <li className={classes.listItem} id="what-is-a-tracker">
          <h2 className={classes.policySubText}>What is a Tracker?</h2>
          <p>
            We use a limited amount of tracker methods that are all explained below. This list is intended to include
            all categories that we use.
          </p>
          <ol type="A">
            <li>
              <h3> Cookies</h3>
              <p>
                A cookie is a small string of text that a website (or online service) stores on a user’s browser. It
                saves data on your browser about your visit to our site or other sites. It often includes a unique
                identifier (e.g., cookie #123).
              </p>
              <p>“First-party cookies” are cookies set by us (or on our behalf) on our site. </p>
              <p>
                “Third-party cookies” are cookies set by other companies whose functionality is embedded into a site
                (e.g., google.com).
              </p>
              <p>
                “Session cookies” are temporary cookies stored on your device while you visit the Interface. They expire
                when you close your browser.{' '}
              </p>
              <p>
                “Persistent cookies” are stored on your browser for a period of time after you leave the Interface.
                Persistent cookies expire on a set expiration date or when they are deleted manually.
              </p>
            </li>
            <li>
              <h3>Software Development Kits (or SDKs)</h3>
              <p>
                SDKs are pieces of code provided by our digital vendors (e.g., third party analytics providers) to
                collect and analyze certain user data.
              </p>
            </li>
          </ol>
        </li>
        <li className={classes.listItem} id="what-do-trackers-do">
          <h2 className={classes.policySubText}>What Trackers Does the Interface Use?</h2>
          <p>Below is a list of the types of trackers that appear on the Interface.</p>
          <ol type="A">
            <li>
              <h3>Essential Trackers</h3>
              <p>
                Essential trackers are required for the Interface to operate. They allow you to navigate the Interface
                and use its services and features. Without essential trackers, the Interface will not run smoothly; in
                fact, the Interface might not even be available to you simply because of technical limitations.
              </p>
              {/* Add table here */}

              <div>
                <table
                  className={classes.tableContainer}
                  style={{ borderCollapse: 'collapse', border: '2px solid #fff' }}
                >
                  <thead className={classes.tableStyle}>
                    <tr>
                      <th className={classes.tableStyle}>Tracker name</th>
                      <th className={classes.tableStyle}>Description of purpose</th>
                      <th className={classes.tableStyle}>
                        If tracker is a cookie, is it a persistent or session cookie? When do persistent cookies expire?
                      </th>
                      <th className={classes.tableStyle}>
                        If tracker is a cookie, 1st party or 3rd party, indicate legal name and URL for cookie policy.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={classes.tableStyle}>opyn-geo</td>
                      <td className={classes.tableStyle}>Geographic information</td>
                      <td className={classes.tableStyle}>session</td>
                      <td className={classes.tableStyle}>first party</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </li>
            <li>
              <h3>Analytics</h3>
              <p>
                Analytics trackers collect or use information about your use of the Interface, which helps us improve
                the Interface. We want to process as little personal information as possible when you use the Interface.{' '}
                {`That's `}
                why we have chosen Fathom Analytics for Interface analytics, which does not use cookies and complies
                with the GDPR, ePrivacy (including PECR), COPPA, and CCPA. Using this privacy-friendly website analytics
                software, your IP address is only briefly processed, and we (running this website) have no way of
                identifying you. As per the CCPA, your personal information is de-identified. You can read more about
                this on{' '}
                <a className={classes.links} href="https://usefathom.com/" target="_blank" rel="noreferrer">
                  Fathom {`Analytics'`} website
                </a>
                .
              </p>
              <p>
                However, if you’d like to entirely exclude your anonymized visits from showing up in our analytics, go
                to the{' '}
                <a
                  className={classes.links}
                  href="https://usefathom.com/docs/script/exclude-visits"
                  target="_blank"
                  rel="noreferrer"
                >
                  Fathom Analytics Exclude Your Visits
                </a>{' '}
                page for opt-out instructions.{' '}
              </p>
            </li>
          </ol>
        </li>
        <li className={classes.listItem} id="how-do-i-manage">
          <h2 className={classes.policySubText}>How Do I Manage Trackers?</h2>

          <p>
            When you first come to the Interface, you may receive a notification that trackers are present. By clicking
            or tapping “accept,” you agree to the use of these trackers as described here. By tapping “I decline” you
            refuse to accept trackers from the interface. If you refuse trackers, you might not be able to use other
            tracker-dependent features of the Interface. To manage specific Tracker settings, review this Cookie Policy
            for further information.{' '}
          </p>
          <h3>Disabling Cookies Through Your Browser </h3>
          <p>
            Most browsers automatically accept cookies, but this is typically something you can adjust. Information for
            each browser can be found in the links below:
          </p>
          <ul>
            <li className={classes.disablingListItems}>
              <a
                className={classes.links}
                href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac"
                rel="noreferrer"
                target="_blank"
              >
                Safari on desktop
              </a>{' '}
              and{' '}
              <a
                className={classes.links}
                href="https://support.apple.com/en-us/HT201265"
                rel="noreferrer"
                target="_blank"
              >
                Safari Mobile (iPhone and iPads):
              </a>{' '}
              Note that, by default, Safari is engineered to protect you from being tracked from site to site unless you
              disable Intelligent Tracking Prevention (ITP).
            </li>
            <li className={classes.disablingListItems}>
              <a
                className={classes.links}
                href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox?redirectlocale=en-US&redirectslug=delete-cookies-remove-info-websites-stored"
                rel="noreferrer"
                target="_blank"
              >
                Firefox:
              </a>{' '}
              By default, Firefox protects you from cross-site tracking so long as you have not disabled Enhanced
              Tracking Protection (ETP). There is therefore less need to manage cookies to protect your privacy.
            </li>
            <li className={classes.disablingListItems}>
              <a href="https://support.google.com/chrome/answer/95647?hl=en" rel="noreferrer" target="_blank">
                Chrome
              </a>
            </li>
            <li className={classes.disablingListItems}>
              <a
                className={classes.links}
                href="https://support.microsoft.com/en-us/help/4468242/microsoft-edge-browsing-data-and-privacy-microsoft-privacy"
                rel="noreferrer"
                target="_blank"
              >
                Microsoft Edge:
              </a>{' '}
              Enabling tracking prevention with Edge will protect you from being tracked between sites, such that there
              will be less of a need to manage your cookies in order to protect your privacy.
            </li>
            <li className={classes.disablingListItems}>
              <a
                className={classes.links}
                href="https://aboutdevice.com/clear-cookies-history-cache-on-samsung-internet-browser-android/"
                target="_blank"
                rel="noreferrer"
              >
                Samsung Internet Browser.
              </a>{' '}
              Note that Samsung Internet Browser includes “Smart Watch” protection that works to help protect you from
              being tracked across sites.
            </li>
            <li className={classes.disablingListItems}>
              Brave: Brave has several mechanisms to keep you from being tracked online, but you can{' '}
              <a
                className={classes.links}
                href="https://support.brave.com/hc/en-us/articles/360017989132-How-do-I-change-my-Privacy-Settings-"
                target="_blank"
                rel="noreferrer"
              >
                change your privacy settings
              </a>{' '}
              if you wish to have greater control over its decisions.{' '}
            </li>
          </ul>
          <p>
            For more information about other browsers, please refer to this{' '}
            <a
              className={classes.links}
              href="https://www.allaboutcookies.org/manage-cookies/"
              target="_blank"
              rel="noreferrer"
            >
              “All About Cookies” guide.
            </a>
          </p>
          <p>
            To reset your device identifier, follow{' '}
            <a
              className={classes.links}
              href="https://support.google.com/googleplay/android-developer/answer/6048248?hl=en"
              target="_blank"
              rel="noreferrer"
            >
              Google instructions
            </a>{' '}
            and{' '}
            <a
              className={classes.links}
              href="https://support.apple.com/en-us/HT205223"
              target="_blank"
              rel="noreferrer"
            >
              Apple instructions.
            </a>
          </p>
        </li>
      </ol>
    </section>
  )
}

export default CookiePolicy
